function twoDigits(value: number) { return String(value).padStart(2, "0"); }
function threeDigits(value: number) { return String(value).padStart(3, "0"); }

export function uniqueDownloadFileName(fileName: string, now = new Date()) {
  const stamp = `${now.getFullYear()}${twoDigits(now.getMonth() + 1)}${twoDigits(now.getDate())}-${twoDigits(now.getHours())}${twoDigits(now.getMinutes())}${twoDigits(now.getSeconds())}-${threeDigits(now.getMilliseconds())}`;
  const extension = fileName.match(/\.eamacro(?:\.json)?$/i)?.[0];
  return extension ? `${fileName.slice(0, -extension.length)}-${stamp}${extension}` : `${fileName}-${stamp}`;
}
