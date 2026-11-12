(() => {
  "use strict";

  // Keep the Spanish legal draft in the HTML as the source and no-script fallback.
  // Like app.js, language follows the browser initially and lives only in memory.
  const translations = {
    es: {},
    en: {
      skip: "Skip to content",
      mainNav: "Main navigation",
      home: "Cotivanta, home",
      language: "Language",
      footerNav: "Footer links",
      policiesIndex: "Policy index",
      backToForm: "Back to the form ↗",
      backHome: 'Back to home <span aria-hidden="true">↗</span>',
      allPolicies: "← View all policies and terms",
      backCotivanta: "← Back to Cotivanta",
      tagline: "Ideas that become digital solutions.",
      services: "Services",
      quote: "Request a quote",
      privacy: "Privacy",
      policies: "Policies & terms",
      copyright: "© 2026 Cotivanta. All rights reserved.",
      legalStatus: "Legal information · Documentation under review.",
      privacyIntro: `
        <span class="eyebrow eyebrow-light"><span class="eyebrow-line"></span>PRIVACY · ARGENTINA</span>
        <h1>How we handle <span>your data.</span></h1>
        <p>Information for people who tell us what they need and request a quote, and for professionals who apply to work with Cotivanta.</p>
        <p class="legal-updated">Last updated: <time datetime="2026-11-12">November 12, 2026</time> · Version 2026-11-12.1-draft · Draft, not approved for receiving real personal data.</p>`,
      privacyNotice: `
        <strong id="draft-title">Review required before enabling the form</strong>
        <p>The controller's legal address, applicable tax information, an approved retention period, the review of providers and international transfers, and the organization of support and security procedures are still pending. This policy does not certify legal compliance or confirm registration with the AAIP.</p>`,
      responsible: `
        <span class="legal-number">01 / DATA CONTROLLER</span>
        <h2 id="responsible-title">Who processes the data</h2>
        <p>The controller of Cotivanta's inquiry and application databases is <strong>Agustín Gonzales</strong>, in Argentina. For general inquiries or to exercise your personal data rights, email <a href="mailto:cotivanta@gmail.com">cotivanta@gmail.com</a>.</p>
        <p><strong>Legal address:</strong> pending. <strong>CUIT (tax identification number) and applicable tax information:</strong> pending. The controller must complete this identification before receiving real personal data.</p>`,
      data: `
        <span class="legal-number">02 / DATA AND THE FORM</span>
        <h2 id="data-title">What we ask for and what happens if you do not provide it</h2>
        <p>In the service request form, the required fields are full name, email address, category, requested service, and a description of what you need. Acceptance of the privacy notice is required. Without these fields and acceptance, the site does not allow the inquiry to be submitted; no obligation to purchase services arises.</p>
        <p>The approximate budget (amount and currency), timeline, desired deadline, WhatsApp number, client type, and company or brand are optional. The selected language is also recorded. You may leave the budget or timeline undecided. Inaccurate data, especially the email address, may prevent us from responding or assessing the request correctly.</p>
        <p>The backend implementation records the acceptance date and the policy version associated with each new request. These records are only created if the form and database are configured and submission completes successfully.</p>
        <p>We do not ask for sensitive data, identity documents, passwords, or credentials. Do not include that information or unnecessary personal data about other people in the description.</p>`,
      purpose: `
        <span class="legal-number">03 / PURPOSE AND CONSENT</span>
        <h2 id="purpose-title">What we would use the information for</h2>
        <p>The only intended commercial purpose is to receive the problem or project you need help with, assess its feasibility, contact you for clarification, and prepare or follow up on a quote. We do not use the form to create accounts, subscribe you to newsletters, advertise, or incorporate analytics tools.</p>
        <p>Processing the inquiry is based on freely given, express, informed consent, in accordance with Articles 5 and 6 of Law 25,326. The checkbox is unchecked by default. You may withdraw consent without retroactive effect by writing to the contact email; this may prevent us from continuing the assessment or contacting you if there is no other lawful ground for retention.</p>
        <p>If you commission a project, you will need to be informed about any additional processing required for that relationship. An inquiry does not authorize uses incompatible with its purpose or, by itself, constitute acceptance of a service contract.</p>`,
      providers: `
        <span class="legal-number">04 / ACCESS AND PROVIDERS</span>
        <h2 id="providers-title">Who can access the information</h2>
        <p>Access must be limited to the controller and team members who need to take part in assessment and response, subject to confidentiality. Their individual permissions must be assigned and checked before launch.</p>
        <ul>
          <li><strong>Supabase:</strong> the intended provider for receiving and storing inquiry data and acceptance records.</li>
          <li><strong>Cloudflare Turnstile:</strong> the intended verification and abuse-prevention service. It may process technical data, such as IP addresses and browser information, when configured and loaded on the site.</li>
          <li><strong>Resend:</strong> the intended provider for sending Cotivanta an internal email notice every time an inquiry or an application arrives. The notice reproduces the data submitted in the form (for example, name, email and description) and lets the team reply to the person who wrote.</li>
          <li><strong>Google / Gmail:</strong> notices and communications sent to cotivanta@gmail.com are processed by the email provider; it would also be used to respond if the team manages inquiries and applications there.</li>
          <li><strong>Independent professionals:</strong> Cotivanta coordinates jobs with independent professionals. If a quote is accepted, the information about the request that is needed to carry it out may be shared with the assigned professional, under a confidentiality commitment that must be documented before launch. Other people's contact details and inquiries that were not accepted are not shared.</li>
          <li><strong>Web hosting:</strong> the final provider is yet to be confirmed; it may process technical browsing and security logs.</li>
        </ul>
        <p>There are no plans to sell data or share it for advertising. Disclosures required by a legal obligation or a valid request from a competent authority may occur.</p>
        <p>Provider sources: <a href="https://supabase.com/privacy">Supabase</a>, <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare</a>, and <a href="https://policies.google.com/privacy?hl=en">Google</a>. Their policies do not replace the controller's obligations or any required agreements.</p>`,
      transfers: `
        <span class="legal-number">05 / INTERNATIONAL TRANSFERS</span>
        <h2 id="transfers-title">Supabase in the United States</h2>
        <p>The controller stated that their Supabase project is hosted in the <strong>United States</strong>. Before enabling the form, the exact region must be checked and additional destinations for support, subprocessors, email, and security services must be reviewed; we do not claim that all processing takes place solely in that country.</p>
        <p>The United States is not on the AAIP's list of adequate destinations consulted for this draft. Transfers must be addressed in accordance with Article 12 of Law 25,326, its Regulatory Decree 1558/2001, and supplementary rules: for example, through applicable contractual safeguards or express consent to the transfer where appropriate.</p>
        <div class="legal-pending"><strong>Mechanism pending verification</strong><p>We do not claim that valid contractual clauses for this case are already in place, nor do we interpret general acceptance of this policy as express consent to an international transfer. Before receiving data, the appropriate mechanism must be selected, documented, and implemented, and its conditions disclosed.</p></div>
        <p>Official information: <a href="https://www.argentina.gob.ar/transferencias-internacionales">AAIP — International transfers</a>.</p>`,
      retention: `
        <span class="legal-number">06 / RETENTION AND SECURITY</span>
        <h2 id="retention-title">Retention, deletion, and protection</h2>
        <p>The specific retention period for inquiries is <strong>pending approval</strong> before launch. The 12-month period in the previous draft is not presented as a legal rule or as a deletion process already implemented. Under Article 4 of Law 25,326, data must be deleted when it is no longer necessary or relevant, without prejudice to applicable retention obligations.</p>
        <p>The procedure must cover the database, email communications, copies, and backups according to their retention cycles; it must also address exceptions justified by legal obligations or third-party rights.</p>
        <p>The code includes input validation, origin controls, Turnstile verification, and a database with RLS and no public read or write permissions. The effective application of these controls depends on correctly deploying and configuring the backend. HTTPS, permissions, secrets, administrator authentication, backups, recovery, and incident response must be verified before launch. Absolute security is not guaranteed, and we do not claim to have audited the production service.</p>`,
      privacyRights: `
        <span class="legal-number">07 / RIGHTS AND COMPLAINTS</span>
        <h2 id="rights-title">How to exercise your rights in Argentina</h2>
        <p>Email <a href="mailto:cotivanta@gmail.com">cotivanta@gmail.com</a>, addressed to Agustín Gonzales, stating whether you request access, rectification, updating, deletion, confidentiality, or withdrawal of consent, and provide a way to respond. No specific wording is required. Your identity will be verified by proportionate means; do not send sensitive documents without a justified instruction and an appropriate channel.</p>
        <ul>
          <li><strong>Access:</strong> a response within 10 calendar days of a formally verifiable request. It is free at intervals of at least six months, unless a legitimate interest is demonstrated, in accordance with Article 14.</li>
          <li><strong>Rectification, updating, or deletion:</strong> the applicable actions must be completed within a maximum of 5 business days of the complaint or discovery of the error, in accordance with Article 16.</li>
          <li><strong>No charge:</strong> rectification, updating, or deletion of inaccurate or incomplete data is free, in accordance with Article 19.</li>
          <li><strong>Limits to deletion:</strong> deletion may not apply where there is a legal retention obligation or where it would harm third parties' rights or legitimate interests; any response must explain its grounds.</li>
        </ul>
        <blockquote class="legal-authority" lang="en">The Agency for Access to Public Information, as the supervisory authority for Law No. 25,326, has the power to address reports and complaints from people whose rights are affected by non-compliance with the rules in force on personal data protection.</blockquote>
        <p>You can find official channels to exercise rights and file complaints at <a href="https://www.argentina.gob.ar/aaip/datospersonales">argentina.gob.ar/aaip/datospersonales</a>. The controller must organize email handling and response deadlines before receiving real requests.</p>`,
      privacyCookies: `
        <span class="legal-number">08 / COOKIES</span>
        <h2 id="cookies-title">No built-in analytics or advertising</h2>
        <p>The current code does not include Analytics, Pixel, or newsletters and does not save the language in cookies or local storage. Hosting and third-party technologies must be checked during deployment. If non-essential technologies are added, their information and consent requirements must be reviewed before loading them.</p>
        <a class="text-link" href="policies.html#cookies">View the cookies and storage policy ↗</a>`,
      professionals: `
        <span class="legal-number">09 / PROFESSIONAL APPLICATIONS</span>
        <h2 id="professionals-title">If you apply to work with Cotivanta</h2>
        <p>The “Work with Cotivanta” form asks for your full name, email address, country of residence, specialties, a description of your experience, a link to your portfolio, languages, availability, pricing model and preferred currency. City, WhatsApp number, years of experience, LinkedIn, other links and an indicative rate are optional. The links you share should point to work or professional profiles you want to show us.</p>
        <p>We do not ask for ID numbers, passwords, bank details or sensitive information. Do not include them in the description or in the links. We record the date of the application, the version of this policy you accepted and an initial internal status of “pending”.</p>
        <p>We use the application only to assess your profile and to contact you when an opportunity matches your skills. <strong>We do not create a public profile or a directory of professionals, we do not create an account for you and we do not share your application with clients.</strong> Applying does not mean you are hired or guarantee you will receive work. If a job is agreed, the information needed to carry it out will be shared only to the extent strictly necessary.</p>
        <p>Processing is based on your freely given, express, informed consent, under the same access, provider, transfer, retention and rights rules described in the other sections. The retention period for applications is also <strong>pending approval</strong>. You may request access, rectification or deletion by writing to <a href="mailto:cotivanta@gmail.com">cotivanta@gmail.com</a>.</p>`,
      versions: `
        <span class="legal-number">10 / VERSIONS AND LEGAL FRAMEWORK</span>
        <h2 id="versions-title">Policy history</h2>
        <p>The version accompanying the forms is <strong>2026-11-12.1-draft</strong>. It is a draft that has not taken effect for receiving real personal data. Subsequent changes must be identified and retained without modifying historical files.</p>
        <ul><li>Current working version: 2026-11-12.1-draft, published on this page.</li><li><a href="privacy/2026-10-30.1-draft.txt">Version 2026-10-30.1-draft — text in force until November 12, 2026 (historical archive, in Spanish)</a>.</li><li><a href="privacy/initial-draft.txt">Previous draft — October 2026 (historical archive, in Spanish)</a>.</li></ul>
        <p>Framework consulted: <a href="https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790/actualizacion">Law 25,326</a>, <a href="https://www.argentina.gob.ar/normativa/nacional/decreto-1558-2001-70368/actualizacion">Decree 1558/2001</a>, and <a href="https://www.argentina.gob.ar/normativa/nacional/norma-307621/texto">AAIP Resolution 14/2018</a>. This general information requires legal review for Cotivanta's actual circumstances.</p>`,
      policiesIntro: `
        <span class="eyebrow eyebrow-light"><span class="eyebrow-line"></span>LEGAL INFORMATION</span>
        <h1>Policies & <span>terms.</span></h1>
        <p>A place to find out how this site is used, how your data would be handled, and what must be agreed before starting a project.</p>
        <p class="legal-updated">Working version · <time datetime="2026-10-30">October 30, 2026</time> · English translation of the Spanish drafts</p>`,
      policiesNotice: `
        <strong id="draft-title">Documentation under review</strong>
        <p>These texts are drafts for Argentina, not a certification of legal compliance. The legal address, applicable tax information, retention period, review of international transfers, and operational procedures are still pending. Receiving real personal data must not be enabled until the information and review are complete.</p>`,
      policiesGrid: `
        <a class="legal-card" href="#aviso-legal"><span class="legal-number">01 /</span><h2>Legal notice</h2><p>Who is behind the site and what information still needs to be completed.</p><span class="legal-card-link">Read <span aria-hidden="true">↗</span></span></a>
        <a class="legal-card" href="#privacidad"><span class="legal-number">02 /</span><h2>Privacy</h2><p>Form data, purposes, providers, and retention.</p><span class="legal-card-link">Read <span aria-hidden="true">↗</span></span></a>
        <a class="legal-card" href="#cookies"><span class="legal-number">03 /</span><h2>Cookies and storage</h2><p>What the site includes and what to review when connecting third parties.</p><span class="legal-card-link">Read <span aria-hidden="true">↗</span></span></a>
        <a class="legal-card" href="#uso"><span class="legal-number">04 /</span><h2>Terms of use</h2><p>Use of the site, content, and links to other services.</p><span class="legal-card-link">Read <span aria-hidden="true">↗</span></span></a>
        <a class="legal-card" href="#contratacion"><span class="legal-number">05 /</span><h2>Service terms</h2><p>Quotes, deliveries, payments, changes, and cancellations.</p><span class="legal-card-link">Read <span aria-hidden="true">↗</span></span></a>
        <a class="legal-card" href="#derechos"><span class="legal-number">06 /</span><h2>Rights and contact</h2><p>How to request access, correction, or deletion of your data.</p><span class="legal-card-link">Read <span aria-hidden="true">↗</span></span></a>`,
      legalNotice: `
        <span class="legal-number">01 / LEGAL NOTICE</span>
        <h2 id="legal-title">Identification of the controller</h2>
        <p>Cotivanta is the name under which a team of three programmers presents its services. The controller for inquiry data is <strong>Agustín Gonzales</strong>, in Argentina. The general and privacy contact email is <a href="mailto:cotivanta@gmail.com">cotivanta@gmail.com</a>.</p>
        <div class="legal-pending"><strong>Pending before publication</strong><ul><li>The controller's full legal address.</li><li>CUIT (tax identification number) and any other applicable tax or registration information.</li><li>Identification of the contracting party and the specific terms for each project.</li><li>Registration of the controller and the inquiry database with the AAIP; we do not claim this procedure has been completed.</li></ul></div>
        <p>This site presents services and allows you to request an assessment. Sending an inquiry does not, by itself, create a contract or confirm that the project has been accepted.</p>`,
      policiesPrivacy: `
        <span class="legal-number">02 / PRIVACY</span>
        <h2 id="privacy-title">Processing of personal data</h2>
        <p>The form asks for your name, email, client type, service, and project description. It also lets you provide a budget, timeline, and company or brand, and records the language and acceptance of the privacy notice. Do not include passwords, credentials, or sensitive data in the description.</p>
        <p>The only intended commercial use is to receive the problem or project, assess it, respond, and prepare a quote. The site has no built-in user registration, newsletter, advertising, or analytics. The planned integration uses Supabase to store inquiries and Cloudflare Turnstile to prevent abuse. The form does not automatically send an email.</p>
        <p>The controller stated that the Supabase project is hosted in the <strong>United States</strong>. Before enabling submissions, the exact region, providers, and applicable transfer mechanism must be verified under Article 12 of Law 25,326 and its regulations. General consent in the form does not, by itself, establish express authorization for that transfer.</p>
        <a class="text-link" href="privacy.html">Read the full privacy notice <span aria-hidden="true">↗</span></a>`,
      policiesCookies: `
        <span class="legal-number">03 / COOKIES AND STORAGE</span>
        <h2 id="cookies-title">Technologies used on the site</h2>
        <p>The site's current code does not include advertising or analytics tools and does not save your language preference in cookies or local storage. The language is kept in memory during your visit to the page.</p>
        <h3>External services and security</h3>
        <p>When Turnstile is configured, the page loads Cloudflare resources to verify the form. This service may process technical information, such as your IP address and browser data. Hosting may also generate technical logs. The actual cookies, storage, and logs of these providers must be verified before launch; we do not claim the site is free of all third-party cookies.</p>
        <p>You can read <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare's privacy policy</a> and <a href="https://supabase.com/privacy">Supabase's privacy policy</a>.</p>
        <h3>If new tools are added</h3>
        <p>Before incorporating analytics, advertising, embedded videos, or other non-essential technologies, this policy must be updated with the provider, purpose, and duration and, where required, prior consent, rejection, and withdrawal of the choice must be implemented. This page does not replace that mechanism.</p>
        <p>Your browser lets you view, block, and delete cookies and stored data. Some restrictions may prevent security checks from working.</p>`,
      use: `
        <span class="legal-number">04 / TERMS OF USE</span>
        <h2 id="use-title">Use of the site and its content</h2>
        <p>The site is intended for learning about Cotivanta's services and sending legitimate inquiries. It must not be used to send spam, impersonate others, share unlawful material, attempt to access other people's information, or interfere with its operation.</p>
        <h3>Content and intellectual property</h3>
        <p>The content and visual identity are subject to the rights of their respective owners. Accessing the site does not grant a license to reuse them beyond uses permitted by law. Rights to the code, designs, and other deliverables of each project must be expressly defined in its proposal or contract.</p>
        <h3>Availability and links</h3>
        <p>Site information may be updated, and the service may experience interruptions or errors. External links lead to third-party sites with their own terms. These clarifications do not remove liabilities or rights that applicable law considers non-waivable.</p>`,
      contract: `
        <span class="legal-number">05 / SERVICE TERMS</span>
        <h2 id="contract-title">Before starting a project</h2>
        <p>The initial inquiry is free and does not oblige you to purchase services. The form does not process payments. Paid work requires a previously agreed proposal identifying the parties and their terms; these texts do not replace that agreement.</p>
        <h3>Scope, deliveries, and changes</h3>
        <p>The proposal must state features, deliverables, stages, timelines, client dependencies, revisions, and acceptance criteria. Additional features and scope changes must be quoted and agreed before they are carried out.</p>
        <h3>Prices and payments</h3>
        <p>Before entering into a contract, the price, currency, applicable taxes, advance payments, and payment schedule must be disclosed. Hosting, domains, licenses, and other third-party expenses must be identified as included or separate.</p>
        <h3>Cancellations, refunds, and support</h3>
        <p>Cancellation terms, settlement for work completed, and any applicable refunds must be agreed in writing, respecting mandatory applicable rights, including consumer rights where relevant. No general ban on refunds is established here.</p>
        <p>Delivery of code and access credentials, intellectual property, confidentiality, warranties, maintenance, and subsequent support must also be defined. If the project processes third-party data, the appropriate data processing agreement must be assessed.</p>`,
      policiesRights: `
        <span class="legal-number">06 / RIGHTS AND CONTACT</span>
        <h2 id="rights-title">Inquiries and requests about your data</h2>
        <p>You can email <a href="mailto:cotivanta@gmail.com">cotivanta@gmail.com</a> to request access, rectification, updating, deletion, or confidentiality of your data, where applicable, and withdraw consent without retroactive effect. Your identity must be verified proportionately, without requesting excessive data.</p>
        <p>Access requests must be answered within <strong>10 calendar days</strong> of a formally verifiable request. Access is free at intervals of at least six months, unless a legitimate interest is demonstrated. Any applicable rectification, updating, or deletion must be completed within <strong>5 business days</strong>; correction or deletion of inaccurate or incomplete data is free.</p>
        <blockquote class="legal-authority" lang="en">The Agency for Access to Public Information, as the supervisory authority for Law No. 25,326, has the power to address reports and complaints from people whose rights are affected by non-compliance with the rules in force on personal data protection.</blockquote>
        <p>See the <a href="https://www.argentina.gob.ar/aaip/datospersonales">AAIP's official channels</a> and the <a href="privacy.html#derechos">procedure described in the privacy policy</a>. Before launch, the controller must organize monitoring of this email and compliance with response deadlines.</p>`,
    },
  };

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    translations.es[el.dataset.i18n] = el.innerHTML;
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    translations.es[el.dataset.i18nAria] = el.getAttribute("aria-label");
  });

  const isPrivacy = Boolean(document.querySelector('meta[name="privacy-version"]'));
  const description = document.querySelector('meta[name="description"]');
  translations.es.title = document.title;
  translations.es.description = description.content;
  translations.en.title = isPrivacy
    ? "Cotivanta — Privacy policy (draft)"
    : "Cotivanta — Policies & terms (draft)";
  translations.en.description = isPrivacy
    ? "Draft of Cotivanta's privacy policy for inquiries and quotes in Argentina."
    : "Cotivanta information about privacy, cookies, site use, and service agreements. Documents under review.";

  function translate(lang) {
    if (!Object.hasOwn(translations, lang)) return;
    const copy = translations[lang];
    document.documentElement.lang = lang;
    document.title = copy.title;
    description.content = copy.description;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      // Only trusted, bundled translations are inserted as HTML, as in app.js.
      if (copy[key] !== undefined) el.innerHTML = copy[key];
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.dataset.i18nAria;
      if (copy[key] !== undefined) el.setAttribute("aria-label", copy[key]);
    });
    document.querySelectorAll("[data-lang]").forEach((button) => {
      const active = button.dataset.lang === lang;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => translate(button.dataset.lang));
  });
  translate((navigator.language || "").toLowerCase().startsWith("en") ? "en" : "es");
})();
