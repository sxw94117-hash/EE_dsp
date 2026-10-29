/* 谱线 · 轻量 Markdown 渲染器 + KaTeX 辅助 */

const MD = (() => {
  const CALLOUT_ICONS = {
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .9 1.6l.1 1.6h5.2l.1-1.6c.1-.6.4-1.2.9-1.6A6 6 0 0 0 12 3Z"/></svg>',
    tip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
  };

  const CJK = /[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/;

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function joinLines(lines) {
    let out = "";
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      if (out && CJK.test(out.slice(-1)) && CJK.test(t[0])) out += t;
      else out += (out ? " " : "") + t;
    }
    return out;
  }

  function inline(raw) {
    if (!raw) return "";
    const maths = [];
    let s = String(raw).replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, (m) => {
      const token = "\u0000M" + maths.length + "\u0000";
      maths.push(escapeHtml(m));
      return token;
    });

    s = s.replace(/`([^`]+)`/g, (m, code) => "<code>" + escapeHtml(code) + "</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

    s = s.replace(/\u0000M(\d+)\u0000/g, (m, i) => maths[Number(i)]);
    return s;
  }

  function parseTable(lines) {
    const rows = lines.map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim())
    );
    if (rows.length < 2) return "";
    const header = rows[0];
    const body = rows.slice(2);
    let html = '<div class="table-wrap"><table><thead><tr>';
    header.forEach((cell) => (html += "<th>" + inline(cell) + "</th>"));
    html += "</tr></thead><tbody>";
    body.forEach((row) => {
      html += "<tr>";
      header.forEach((_, i) => (html += "<td>" + inline(row[i] || "") + "</td>"));
      html += "</tr>";
    });
    html += "</tbody></table></div>";
    return html;
  }

  function isBlockStart(lines, i) {
    const t = lines[i].trim();
    return (
      /^#{2,4}\s/.test(t) ||
      /^```/.test(t) ||
      /^>/.test(t) ||
      /^\|/.test(t) ||
      /^([-*]|\d+\.)\s/.test(t) ||
      /^<[a-zA-Z/!]/.test(t) ||
      /^---+$/.test(t) ||
      /^\$\$/.test(t)
    );
  }

  function parse(src) {
    if (!src) return "";
    const lines = String(src).replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let i = 0;
    let section = 0;

    while (i < lines.length) {
      const raw = lines[i];
      const line = raw.trim();

      if (!line) {
        i++;
        continue;
      }

      // 代码块
      if (/^```/.test(line)) {
        const lang = line.slice(3).trim();
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i].trim())) {
          buf.push(lines[i]);
          i++;
        }
        i++;
        out.push(
          '<pre><code' +
            (lang ? ' class="language-' + escapeHtml(lang) + '"' : "") +
            ">" +
            escapeHtml(buf.join("\n")) +
            "</code></pre>"
        );
        continue;
      }

      // 标题
      const hm = line.match(/^(#{2,4})\s+(.+)$/);
      if (hm) {
        const level = hm[1].length;
        section++;
        const id = "sec-" + section;
        out.push("<h" + level + ' id="' + id + '">' + inline(hm[2]) + "</h" + level + ">");
        i++;
        continue;
      }

      // 分隔线
      if (/^---+$/.test(line)) {
        out.push("<hr />");
        i++;
        continue;
      }

      // 引用 / 提示框
      if (/^>/.test(line)) {
        const buf = [];
        while (i < lines.length && /^>/.test(lines[i].trim())) {
          buf.push(lines[i].trim().replace(/^>\s?/, ""));
          i++;
        }
        let type = "info";
        let title = "";
        const head = buf[0] && buf[0].match(/^\[!(note|tip|warn|key|info)\]\s*(.*)$/i);
        let contentLines = buf;
        if (head) {
          type = head[1].toLowerCase();
          title = head[2] || "";
          contentLines = buf.slice(1);
        }
        const paragraphs = [];
        let cur = [];
        contentLines.forEach((l) => {
          if (!l.trim()) {
            if (cur.length) paragraphs.push(cur.join(" "));
            cur = [];
          } else cur.push(l);
        });
        if (cur.length) paragraphs.push(cur.join(" "));
        const body = paragraphs.map((p) => "<p>" + inline(p) + "</p>").join("");
        out.push(
          '<div class="callout ' +
            type +
            '"><div class="callout-icon">' +
            (CALLOUT_ICONS[type] || CALLOUT_ICONS.info) +
            '</div><div class="callout-body">' +
            (title ? '<strong class="callout-title">' + inline(title) + "</strong>" : "") +
            body +
            "</div></div>"
        );
        continue;
      }

      // 表格
      if (/^\|/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\|/.test(lines[i].trim())) {
          buf.push(lines[i]);
          i++;
        }
        out.push(parseTable(buf));
        continue;
      }

      // 列表
      if (/^([-*]|\d+\.)\s/.test(line)) {
        const ordered = /^\d+\.\s/.test(line);
        const items = [];
        while (i < lines.length) {
          const t = lines[i].trim();
          const m = t.match(/^([-*]|\d+\.)\s+(.*)$/);
          if (!m) break;
          items.push(m[2]);
          i++;
          // 支持列表项后续缩进行
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^([-*]|\d+\.)\s/.test(lines[i].trim())) {
            items[items.length - 1] += " " + lines[i].trim();
            i++;
          }
        }
        const tag = ordered ? "ol" : "ul";
        out.push("<" + tag + ">" + items.map((it) => "<li>" + inline(it) + "</li>").join("") + "</" + tag + ">");
        continue;
      }

      // 原始 HTML（figure / svg 等）
      if (/^<[a-zA-Z/!]/.test(line)) {
        const buf = [];
        while (i < lines.length && lines[i].trim() && /^</.test(lines[i].trim())) {
          buf.push(lines[i]);
          i++;
        }
        out.push(buf.join("\n"));
        continue;
      }

      // 独立公式
      if (/^\$\$/.test(line)) {
        out.push('<div class="math-display">' + escapeHtml(line) + "</div>");
        i++;
        continue;
      }

      // 段落
      const buf = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines, i)) {
        buf.push(lines[i]);
        i++;
      }
      out.push("<p>" + inline(joinLines(buf)) + "</p>");
    }

    return out.join("\n");
  }

  function plain(src) {
    return String(src || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\$\$[\s\S]*?\$\$/g, " ")
      .replace(/\$[^$]*\$/g, " ")
      .replace(/[#>*_`|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return { parse, inline, plain, escapeHtml };
})();

function renderMathIn(root) {
  if (!window.renderMathInElement || !root) return;
  try {
    window.renderMathInElement(root, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
      ],
      throwOnError: false,
      strict: false,
      trust: false,
      macros: {
        "\\RR": "\\mathbb{R}",
        "\\NN": "\\mathbb{N}",
        "\\ZZ": "\\mathbb{Z}",
      },
    });
  } catch (e) {
    console.warn("KaTeX render failed", e);
  }
}
