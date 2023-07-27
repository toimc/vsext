// 获取所有的本地的vscode-extensions, code --list-extensions --show-versions 命令，返回回来的格式是
// 判断是否有downloads目录，如果没有则创建
// 下载所有的extensions到downloads目录
// 下载链接为 https://marketplace.visualstudio.com/_apis/public/gallery/publishers/${creator}/vsextensions/${name}/${version}/vspackage
import { promisify } from 'util';
import { exec as execCmd } from 'child_process';
import fs from 'fs';
import path from 'path';
import got from 'got';

const exec = promisify(execCmd);
let count = 0;
let arr = [];

const directory = 'downloads';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getExtInfo(str) {
  const regex = /([^.]+)\.([^@]+)@(.+)/;
  const match = str.match(regex);

  return {
    creator: match[1],
    name: match[2],
    version: match[3],
  };
}

function mkdir(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory);
    console.log(`已创建 ${directory} 目录`);
  } else {
    console.log(`${directory} 目录已存在`);
  }
}

function downloadFile({ creator, name, version }, retries = 3) {
  // 下载链接为 https://marketplace.visualstudio.com/_apis/public/gallery/publishers/${creator}/vsextensions/${name}/${version}/vspackage
  const url = `https://marketplace.visualstudio.com/_apis/public/gallery/publishers/${creator}/vsextensions/${name}/${version}/vspackage`;

  const fileName = `${creator}.${name}-${version}.vsix`;
  const filePath = path.join(directory, fileName);

  if (fs.existsSync(filePath)) {
    // 文件已存在，判断是否大小为0，如果为0，则删除
    const fileStats = fs.statSync(filePath);
    if (fileStats.size === 0) {
      fs.unlinkSync(filePath);
    } else {
      count++;
      console.log(`文件 ${fileName} 已存在，跳过下载.`);
      return;
    }
  }

  const response = got.stream(url, {
    retry: {
      limit: 5,
      statusCodes: [429],
      // ((2 ** (attemptCount - 1)) * 1000) + noise
      calculateDelay: ({ computedValue }) => {
        return computedValue / 10;
      },
    },
  });

  const writeStream = fs.createWriteStream(filePath);

  response.on('retry', () => {
    console.log(`${fileName} 重试下载`);
    downloadFile({ creator, name, version }, retries - 1);
    return;
  });

  response.pipe(writeStream);

  const onError = (err) => {
    if (fs.existsSync(filePath)) {
      // 删除失败任务的文件
      fs.unlinkSync(filePath);
    }
    if (retries > 0) {
      return sleep(5000).then(() => downloadFile({ creator, name, version }, retries - 1));
    } else {
      console.log('stream异常', err);
    }
  };

  writeStream.on('finish', () => {
    count++;
    console.log(`文件 ${fileName} 下载完成， 总下载进度: ${count}/${arr.length}`);
  });

  response.on('error', onError);
  writeStream.on('error', onError);
}

export async function main(argv) {
  const t = argv && argv.retries ? argv.retries : 3;
  // 全局定义
  // let arr = [];
  try {
    console.log('执行code命令，获取本地插件列表');
    const { stdout } = await exec('code --list-extensions --show-versions');
    arr = stdout.split('\n').filter((line) => line);
    arr = arr.map((str) => getExtInfo(str));
    console.log('插件列表获取成功，总数：' + arr.length);
    mkdir(directory);
    // 下载所有的extensions到downloads_info目录
    // https://marketplace.visualstudio.com/_apis/public/gallery/publishers/formulahendry/vsextensions/auto-close-tag/0.5.14/vspackage
    console.log('准备开始下载，单任务重试次数：' + t);
    for (let i = 0; i < arr.length; i++) {
      downloadFile(arr[i], t);
    }
  } catch (error) {
    console.error(`执行命令时出错: `, error);
  }
  console.log(`总下载进度：${count}，预期下载${arr.length}，剩余未下载:${arr.length - count}`);
}

async function installExtensions() {
  // 获取下载目录中的所有文件
  const files = await fs.promises.readdir(directory);

  // 过滤出 .vsix 文件
  const vsixFiles = files.filter((file) => file.endsWith('.vsix'));

  // 为每个 .vsix 文件执行安装命令
  for (const file of vsixFiles) {
    const filePath = path.join(directory, file);
    try {
      const { stdout } = await exec(`code --install-extension ${filePath}`);
      // if (stderr) {
      console.log(stdout);
      //   console.error(`安装扩展 ${file} 时出错: ${stderr}`);
      // } else {
      //   console.log(`已成功安装扩展 ${file}:\n${stdout}`);
      // }
    } catch (error) {}
  }
}

export async function download(argv) {
  main(argv).catch((err) => {
    console.log('执行main失败', err);
  });
}

export async function install() {
  installExtensions().catch((err) => {
    console.log('执行安装失败', err);
  });
}
