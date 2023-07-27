#!/usr/bin/env node

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { download, install } from './utils.mjs';

yargs(hideBin(process.argv))
  .command(
    ['download', 'd'],
    '批量下载vscode插件文件',
    (yargs) => {
      // 在这里添加选项
      yargs.option('retries', {
        alias: 'r',
        describe: '重试次数，默认为3次',
        type: 'number',
      });
    },
    (argv) => {
      // 在这里添加下载文件的逻辑
      download(argv);
    }
  )
  .command(['install', 'i'], '安装vscode插件', () => {
    // 在这里添加安装文件的逻辑
    install();
  })
  .demandCommand(1, '你必须提供一个命令')
  .help().argv;
