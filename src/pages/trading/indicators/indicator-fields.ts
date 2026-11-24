// Shared field styles using the terminal's existing theme tokens.
export const fieldClass="mt-1 block min-w-0 w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-current disabled:opacity-50 disabled:cursor-not-allowed";
export const codeFieldClass=fieldClass+" min-h-24 resize-y font-mono";
export const checkClass="h-4 w-4 shrink-0 accent-current focus-visible:outline focus-visible:outline-1 disabled:opacity-50";
export const colorFieldClass="h-8 w-full rounded border border-border bg-background p-1 focus-visible:outline focus-visible:outline-1";
export const fileFieldClass=fieldClass+" file:mr-2 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:text-foreground";
export const labelClass="block min-w-0 text-xs font-medium";
export const numericBounds={offset:{min:1,max:100,step:1},width:{min:1,max:20,step:1},lineWidth:{min:1,max:5,step:1},opacity:{min:0.1,max:1,step:0.1}} as const;
