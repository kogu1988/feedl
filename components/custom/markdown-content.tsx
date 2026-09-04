import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

// Sprint 40: ortak markdown renderer — yorumlar ve changelog paylaşır.
// react-markdown ham HTML'i varsayılan olarak render etmez (XSS güvenli);
// remark-gfm tablo/görev listesi ekler, remark-breaks tek satır sonunu
// satır sonu yapar (yorum beklentisi). Dış bağlantılar yeni sekmede açılır.
const ROOT_STYLES =
  "text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" +
  " [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4" +
  " [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground" +
  " [&_code]:rounded-md [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]" +
  " [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3" +
  " [&_pre_code]:bg-transparent [&_pre_code]:p-0" +
  " [&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-bold" +
  " [&_h2]:mt-3 [&_h2]:text-[15px] [&_h2]:font-bold" +
  " [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold" +
  " [&_h4]:mt-3 [&_h4]:text-sm [&_h4]:font-semibold" +
  " [&_hr]:border-border" +
  " [&_img]:max-w-full [&_img]:rounded-md" +
  " [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5" +
  " [&_strong]:font-semibold" +
  " [&_table]:my-2 [&_table]:w-full [&_table]:text-xs" +
  " [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1" +
  " [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1";

export function MarkdownContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={className ? `${ROOT_STYLES} ${className}` : ROOT_STYLES}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ node, ...props }) => {
            const href = props.href ?? "";
            const external = /^https?:\/\//.test(href);
            return (
              <a
                {...props}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : null)}
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
