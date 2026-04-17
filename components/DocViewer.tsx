'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DocViewerProps {
  content: string;
}

export default function DocViewer({ content }: DocViewerProps) {
  return (
    <article className="prose-doc max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-primary border-b-2 border-[#FF6F0F] pb-2 mb-6">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold text-primary mt-8 mb-4 pl-3 border-l-4 border-[#FF6F0F]">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-[#FF6F0F] mt-6 mb-3">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold text-secondary mt-4 mb-2">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="text-secondary leading-7 my-3">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-6 my-3 space-y-1 text-secondary">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 my-3 space-y-1 text-secondary">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-7">{children}</li>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer"
              className="text-blue-400 hover:underline">
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return <code className={className}>{children}</code>;
            }
            return (
              <code className="px-1.5 py-0.5 bg-fill-subtle text-amber-400 rounded text-sm font-mono">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-sidebar border border-border-main rounded-lg p-4 overflow-x-auto my-4 text-sm">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#FF6F0F] bg-[#FF6F0F]/5 pl-4 pr-4 py-3 my-4 italic rounded-r-lg">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-border-main">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-fill-subtle">{children}</thead>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-primary border-b-2 border-[#FF6F0F]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-border-subtle text-secondary align-top">
              {children}
            </td>
          ),
          hr: () => <hr className="my-8 border-border-main" />,
          strong: ({ children }) => <strong className="text-primary font-semibold">{children}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
