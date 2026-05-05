export function getScanPlaceholderMessage(): string {
  return [
    "ContextForge scan command is available.",
    "Scanning is not implemented yet."
  ].join(" ");
}

export function main(): void {
  console.log(getScanPlaceholderMessage());
}

main();
