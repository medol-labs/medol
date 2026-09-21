import type { DocumentationLanguage } from './documentationModel';

const chineseNumerals = [
  '零',
  '一',
  '二',
  '三',
  '四',
  '五',
  '六',
  '七',
  '八',
  '九'
];

export const numberMarkdownHeadings = (
  markdown: string,
  language: DocumentationLanguage
): string => {
  if (language !== 'zh-CN') return markdown;

  const counters: number[] = [];
  let inFence = false;
  let currentSectionId: string | undefined;
  let documentCodePrefix = 'DOC';
  let documentTypeCode = 'DOC';
  const usedHeadingCodes = new Map<string, number>();
  return markdown.split(/\r?\n/).map((line) => {
    if (/^\s*(```|~~~)/u.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    const marker = line.match(/^\s*<!--\s*em:section\b([^>]*)-->\s*$/u);
    if (marker) {
      currentSectionId = marker[1].match(/\bid="([^"]+)"/u)?.[1];
      return line;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/u);
    if (!heading) return line;

    const level = heading[1].length;
    if (level === 1) {
      documentCodePrefix = buildDocumentCodePrefix(heading[2]);
      documentTypeCode = inferDocumentTypeCode(heading[2]);
      return line;
    }

    const title = stripHeadingNumber(heading[2]);
    if (
      currentSectionId === 'document.version-history'
      || currentSectionId === 'document.changeLog'
      || currentSectionId === 'document.toc'
    ) {
      currentSectionId = undefined;
      return `${heading[1]} ${title}`;
    }

    const chapterLevel = level - 2;
    counters[chapterLevel] = (counters[chapterLevel] ?? 0) + 1;
    counters.length = chapterLevel + 1;
    for (let index = 0; index < chapterLevel; index += 1) {
      counters[index] = counters[index] || 1;
    }

    const prefix = chapterLevel === 0
      ? `${toChineseSectionNumber(counters[0])}、`
      : `${counters.slice(0, chapterLevel + 1).join('.')} `;
    const headingCode = uniqueHeadingCode(buildHeadingCode(title), usedHeadingCodes);
    const code = `${documentCodePrefix}-${documentTypeCode}-${headingCode}`;
    return `${heading[1]} ${prefix}${title}/${code}`;
  }).join('\n');
};

const stripHeadingNumber = (title: string): string =>
  title
    .replace(/\/[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*\s*$/u, '')
    .replace(/^(?:[零〇一二三四五六七八九十百千万两]+[、.．]\s*)/u, '')
    .replace(/^(?:\d+(?:\.\d+)*[、.．]?\s+)/u, '')
    .trim();

const buildDocumentCodePrefix = (title: string): string => {
  const meaningfulTitle = title
    .replace(/\b(?:Product|Requirements?|Acceptance|Document|Software|Design|Database|Test|Outline|Business|Process)\b/giu, ' ')
    .replace(/\b(?:PRD|SD|DB|TO|PROC|DOC)\b/giu, ' ')
    .replace(/产品需求与验收文档|产品需求文档|软件设计|数据库设计|测试大纲|业务流程/gu, ' ');
  const asciiWords = meaningfulTitle.match(/[A-Za-z][A-Za-z0-9]*/gu) ?? [];
  const prefix = asciiWords
    .map((word) => word[0])
    .join('')
    .slice(0, 8)
    .toUpperCase();
  return prefix || 'DOC';
};

const inferDocumentTypeCode = (title: string): string => {
  if (/产品需求|Product Requirements|\bPRD\b/iu.test(title)) return 'PRD';
  if (/软件设计|Software Design/iu.test(title)) return 'SD';
  if (/数据库设计|Database Design/iu.test(title)) return 'DB';
  if (/测试大纲|Test Outline/iu.test(title)) return 'TO';
  if (/业务流程|Business Process/iu.test(title)) return 'PROC';
  return 'DOC';
};

const uniqueHeadingCode = (code: string, usedCodes: Map<string, number>): string => {
  const count = usedCodes.get(code) ?? 0;
  usedCodes.set(code, count + 1);
  return count === 0 ? code : `${code}-${count + 1}`;
};

const buildHeadingCode = (title: string): string => {
  const normalizedTitle = title.trim();
  const mappedCode = chineseHeadingCodeMap[normalizedTitle];
  if (mappedCode) return mappedCode;
  const asciiWords = normalizedTitle
    .replace(/[（(].*?[）)]/gu, ' ')
    .match(/[A-Za-z][A-Za-z0-9]*/gu) ?? [];
  const code = asciiWords
    .map((word) => word[0])
    .join('')
    .slice(0, 8)
    .toUpperCase();
  return code || 'SECTION';
};

const chineseHeadingCodeMap: Record<string, string> = {
  产品背景与目标: 'BAG',
  业务背景: 'BB',
  范围与边界: 'SAB',
  角色与权限矩阵: 'RPM',
  业务对象概览: 'BOO',
  功能总览: 'FO',
  功能需求: 'FR',
  用户体验与入口: 'UEAEP',
  验收矩阵: 'AM',
  数据与业务规则: 'DABR',
  自动化与集成: 'OAI',
  非功能需求: 'NFR',
  交付验收检查表: 'DAC',
  待确认事项: 'OQ',
  概要设计: 'OD',
  上下文地图: 'CM',
  部署视图: 'DV',
  逻辑架构: 'LA',
  限界上下文与模块划分: 'BCAMD',
  详细设计: 'DD',
  业务对象设计: 'BOD',
  应用服务与能力设计: 'ASCD',
  异常与规则设计: 'ERD',
  规则与异常设计: 'RAED',
  上下文数据设计: 'CDD',
  值类型设计: 'VTD',
  接口与集成设计: 'IID',
  页面设计: 'UID',
  集成设计: 'ID',
  '质量属性、运维与可观测性设计': 'QAOO',
  实现缺口: 'IG',
  测试目标与范围: 'TGAS',
  测试对象: 'TO',
  测试范围边界: 'TSB',
  纳入测试范围: 'ITS',
  不纳入测试范围: 'OOS',
  测试策略: 'TST',
  测试环境与测试数据: 'TETD',
  测试类型: 'TT',
  功能测试范围: 'FTS',
  测试场景覆盖: 'TSC',
  业务规则与异常测试: 'BRAET',
  接口与集成测试: 'IIT',
  '数据与 Read Model 测试': 'DRMT',
  非功能测试范围: 'NFTS',
  缺口驱动测试: 'GDT',
  回归与自动化计划: 'RAP',
  准出标准: 'EC',
  系统说明: 'SD',
  部署架构: 'DA',
  系统组件: 'SC',
  部署拓扑: 'DT',
  组件依赖: 'CD',
  环境要求: 'ER',
  运行环境要求: 'RER',
  硬件要求: 'HR',
  软件要求: 'SR',
  网络与端口: 'NP',
  安装介质: 'IM',
  安装前准备: 'PIP',
  安装准备清单: 'IPC',
  安装步骤: 'IS',
  配置说明: 'CI',
  初始化: 'INIT',
  启动与停止: 'SS',
  安装验证: 'IV',
  升级与回滚: 'UR',
  运维操作: 'OO',
  日志位置: 'LL',
  故障排查: 'TS',
  常见问题: 'FAQ',
  卸载与数据清理: 'UDC',
  '附录A 端口清单': 'APA',
  '附录B 配置参数清单': 'APB',
  '附录C 目录清单': 'APC',
  安装范围: 'ISCOPE',
  数据视图: 'DV',
  旅程概览: 'JO',
  角色旅程摘要: 'AJS',
  端到端旅程图: 'E2EJM',
  业务域旅程: 'CDJ',
  关键时刻与业务规则: 'KMBR',
  数据视图与反馈: 'DVF',
  'AI 辅助业务梳理提示词': 'AIP',
  用户范围: 'US',
  概述: 'OV',
  角色与权限: 'RAP',
  快速开始: 'QS',
  控制台与操作边界: 'COB',
  功能操作指南: 'FOG',
  数据视图与查询: 'DVQ',
  规则与异常: 'RAE',
  常见问题处理: 'FAQH',
  '后端 / API 范围': 'BAS',
  上下文说明: 'CDESC',
  功能操作: 'FO',
  列表视图: 'LV',
  详情视图: 'DVW',
  设计范围: 'DS',
  'Read Model 清单': 'RMI',
  逻辑结构: 'LS',
  访问路径: 'AP',
  更新语义: 'USM',
  数据库通用决策: 'DGD',
  端到端流程概览: 'E2EPO',
  流程风险与待确认事项: 'PROQ'
};

const toChineseSectionNumber = (value: number): string => {
  if (value <= 0) return chineseNumerals[0];
  if (value < 10) return chineseNumerals[value];
  if (value === 10) return '十';
  if (value < 20) return `十${chineseNumerals[value % 10]}`;
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    return `${chineseNumerals[tens]}十${ones ? chineseNumerals[ones] : ''}`;
  }
  return String(value);
};
