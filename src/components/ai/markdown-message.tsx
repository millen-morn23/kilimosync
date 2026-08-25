import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

// Only http(s)/mailto links are ever rendered as clickable — react-markdown's
// default urlTransform already strips dangerous schemes like `javascript:`,
// this is a second, explicit layer on top of it. Raw HTML in a Gemini/
// Claude reply is never executed: no rehype-raw plugin is registered, and
// skipHtml drops any literal HTML in the source instead of rendering it.
function safeHref(href?: string): string | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href, "https://kilimosync.invalid");
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") {
      return href;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

const components: Components = {
  p: ({ children }) => <p className="mb-2 leading-relaxed break-words last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => {
    const safe = safeHref(href);
    if (!safe) return <span>{children}</span>;
    return (
      <a
        href={safe}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="font-medium text-primary underline underline-offset-2 hover:no-underline"
      >
        {children}
      </a>
    );
  },
  ul: ({ children }) => (
    <ul className="mb-2 ml-4 list-disc space-y-1 break-words last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-1 break-words last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
  h1: ({ children }) => (
    <h1 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h4>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-primary/40 pl-3 text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
  pre: ({ children }) => (
    <pre className="mb-2 max-w-full overflow-x-auto rounded-lg bg-foreground/5 p-3 text-xs last:mb-0">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code className={`${className ?? ""} font-mono`}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[0.85em] break-words">
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="mb-2 max-w-full overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-border">{children}</thead>,
  th: ({ children }) => <th className="px-2 py-1 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-t border-border px-2 py-1">{children}</td>,
};

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="min-w-0 text-sm">
      <Markdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
        {content}
      </Markdown>
    </div>
  );
}
