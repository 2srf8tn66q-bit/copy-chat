/**
 * 解析器统一入口
 *
 * 提供文本粘贴解析和 HTML 上传解析的统一导出，
 * 以及从文件列表构建 fileMap 的辅助函数。
 */

export { parseTextChat } from './textParser';
export type { ParseResult } from './textParser';

export { parseHTMLChat } from './htmlParser';
export type { HTMLParseResult, HTMLMediaFile } from './htmlParser';

/**
 * 从文件列表构建 fileMap（用于 HTML 解析）
 *
 * 遍历上传的文件列表，以相对路径（或文件名）为 key 构建 Map。
 * 当用户上传 WeChatExporter 导出的文件夹时，HTML 文件中的资源引用
 * 使用相对路径，此函数将其映射到实际的 File 对象。
 *
 * @param files - 用户上传的文件列表（可能来自 input.webkitdirectory 或拖拽文件夹）
 * @returns Map<相对路径, File对象>
 */
export function buildFileMap(files: File[]): Map<string, File> {
  const fileMap = new Map<string, File>();

  for (const file of files) {
    // file.webkitRelativePath 包含相对路径，如 "export/img/photo.jpg"
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;

    if (relativePath) {
      // 存储完整相对路径
      fileMap.set(relativePath, file);

      // 同时存储文件名作为 key（方便短路径匹配）
      const filename = relativePath.split('/').pop();
      if (filename) {
        // 如果有同名文件，不覆盖（保留第一个）
        if (!fileMap.has(filename)) {
          fileMap.set(filename, file);
        }
      }

      // 也存储去掉顶层目录的路径
      // "export/img/photo.jpg" → "img/photo.jpg"
      const parts = relativePath.split('/');
      if (parts.length > 2) {
        const subPath = parts.slice(1).join('/');
        if (!fileMap.has(subPath)) {
          fileMap.set(subPath, file);
        }
      }
    } else {
      // 没有 webkitRelativePath，直接用文件名
      fileMap.set(file.name, file);
    }
  }

  return fileMap;
}
