import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { preparePrivacyHtml } from "@/lib/legal/privacy-html";

describe("preparePrivacyHtml", () => {
  it("names OpenAI, Anthropic, and DeepSeek as AI providers", () => {
    const raw = `<body>
      <h1>PRIVACY POLICY</h1>
      <h2>TABLE OF CONTENTS</h2>
      <a href="#ai">6. AI</a>
      <div id="infocollect"><h2>1. WHAT INFORMATION DO WE COLLECT?</h2></div>
      <div id="ai">
        <h2>6. DO WE OFFER ARTIFICIAL INTELLIGENCE-BASED PRODUCTS?</h2>
        <p>third-party service providers ( " AI Service Providers " ), including OpenAI .</p>
      </div>
    </body>`;
    const out = preparePrivacyHtml(raw);
    assert.doesNotMatch(out, /<h1\b/i);
    assert.match(out, /OpenAI/i);
    assert.match(out, /Anthropic \(Claude\)/i);
    assert.match(out, /DeepSeek/i);
    assert.match(out, /6\. Do we offer artificial intelligence-based products\?/i);
  });

  it("does not keep infrastructure IPs or hosting vendor names", () => {
    const raw = `<body>
      <div id="infocollect"><h2>1. WHAT INFORMATION DO WE COLLECT?</h2></div>
      <div id="intltransfers">
        <p>Our servers are located in Germany and United States.</p>
        <p>Bad leak Coolify on 217.76.58.141 Hetzner at server.nurahelp.com</p>
      </div>
    </body>`;
    const out = preparePrivacyHtml(raw);
    assert.match(out, /European Union and the United States/i);
    assert.doesNotMatch(out, /Our servers are located in Germany and United States/i);
    assert.doesNotMatch(out, /217\.76\.58\.141/);
    assert.doesNotMatch(out, /Coolify/i);
    assert.doesNotMatch(out, /Hetzner/i);
    assert.doesNotMatch(out, /server\.nurahelp\.com/i);
  });

  it("rewrites support mail and strips Termly presentation", () => {
    const raw = `<body>
      <div id="infocollect"><h2>1. WHAT INFORMATION DO WE COLLECT?</h2>
        <span style="font-size:11.0pt;color:#595959;">Contact support@nurahelp.com</span>
      </div>
    </body>`;
    const out = preparePrivacyHtml(raw);
    assert.match(out, /data-open-help/);
    assert.doesNotMatch(out, /support@nurahelp\.com/i);
    assert.doesNotMatch(out, /\sstyle=/i);
  });

  it("injects Nura product details from the prior Privacy draft", () => {
    const raw = `<body>
      <div id="infocollect"><h2>1. WHAT INFORMATION DO WE COLLECT?</h2></div>
      <div id="request"><h2>16. HOW CAN YOU REVIEW?</h2></div>
    </body>`;
    const out = preparePrivacyHtml(raw);
    assert.match(out, /id="nura-privacy"/);
    assert.match(out, /GDPR Article 9\(2\)\(a\)/);
    assert.match(out, /SUD\/VoC/);
    assert.match(out, /id="update-or-delete"/);
    assert.match(out, /Facebook Login/);
    assert.match(out, /Danger zone/);
    assert.match(out, /Cloudflare/);
    assert.match(out, /Brevo/);
    assert.match(out, /row-level\s+security/i);
    assert.doesNotMatch(out, /Coolify|Hetzner|217\.76/);
    // Addendum before §1
    assert.ok(out.indexOf("nura-privacy") < out.indexOf('id="infocollect"'));
  });

  it("strips Termly generator footer and termly.io links", () => {
    const raw = `<body>
      <div id="infocollect"><h2>1. WHAT INFORMATION DO WE COLLECT?</h2></div>
      <div style="display: none;"><a class="privacy123" href="https://app.termly.io/dsar/abc"></a></div>
      <div><span>This Privacy Policy was created using Termly's </span><a href="https://termly.io/products/privacy-policy-generator/">Privacy Policy Generator</a></div>
    </body>`;
    const out = preparePrivacyHtml(raw);
    assert.doesNotMatch(out, /Termly/i);
    assert.doesNotMatch(out, /termly\.io/i);
    assert.doesNotMatch(out, /created using/i);
    assert.doesNotMatch(out, /Privacy Policy Generator/i);
  });
});
