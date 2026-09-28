import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Thiệp mời điện tử',
  description: 'Những khoảnh khắc đặc biệt được kể lại theo dấu ấn riêng của bạn.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Netlify prepends a newline to its hosting comment. Remove only
                  // that extra text node before hydration; preserve the comment.
                  if (typeof NodeFilter !== 'undefined') {
                    var comments = document.createTreeWalker(document.head, NodeFilter.SHOW_COMMENT);
                    var comment;
                    while ((comment = comments.nextNode())) {
                      if (comment.textContent.trim().startsWith('This site is hosted on Netlify.')) {
                        var spacer = comment.previousSibling;
                        if (spacer && spacer.nodeType === Node.TEXT_NODE && !spacer.textContent.trim()) {
                          spacer.remove();
                        }
                      }
                    }
                  }
                  var origSetAttr = Element.prototype.setAttribute;
                  Element.prototype.setAttribute = function(name, val) {
                    if (name === 'bis_skin_checked') return;
                    return origSetAttr.apply(this, arguments);
                  };
                  var observer = new MutationObserver(function(mutations) {
                    for (var i = 0; i < mutations.length; i++) {
                      var m = mutations[i];
                      if (m.attributeName === 'bis_skin_checked' && m.target && m.target.removeAttribute) {
                        m.target.removeAttribute('bis_skin_checked');
                      }
                    }
                  });
                  observer.observe(document.documentElement, {
                    attributes: true,
                    subtree: true,
                    attributeFilter: ['bis_skin_checked']
                  });
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
