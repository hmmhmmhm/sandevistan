// Keep nested fence examples intact. An inner, shorter fence cannot close its parent.
export function parseFencedCode(source) {
  const lines = source.split("\n");
  const prose = [];
  const blocks = [];
  let fence = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const marker = line.match(/^\s*(`{3,}|~{3,})(.*)$/u);
    if (!fence && marker && !(marker[1][0] === "`" && marker[2].includes("`"))) {
      fence = { character: marker[1][0], length: marker[1].length, start: index };
      prose.push("");
      continue;
    }
    if (fence) {
      prose.push("");
      if (marker && marker[1][0] === fence.character && marker[1].length >= fence.length && !marker[2].trim()) {
        blocks.push(lines.slice(fence.start, index + 1).join("\n"));
        fence = null;
      }
    } else prose.push(line);
  }
  if (fence) blocks.push(lines.slice(fence.start).join("\n"));
  return { prose: prose.join("\n"), blocks, unclosed: fence !== null };
}
