# Licenses and pre-launch checklist (CourtFlow)

This document lists **software licenses** you use in CourtFlow and a **pre-launch checklist** of licenses and compliance to consider before launching the startup. It is not legal advice; consult a lawyer and (where relevant) a local business advisor before launch.

---

## 1. Open-source software licenses (dependencies)

CourtFlow uses the following main dependencies. You must comply with their licenses (typically attribution and/or including the license text).

| Package | Typical license | What you usually need to do |
|--------|-----------------|-----------------------------|
| **Python** | PSF License | Permissive; no fee, keep copyright notice if you redistribute Python. |
| **FastAPI** | MIT | Include MIT license + copyright in your app’s “Licenses” or NOTICE file. |
| **Uvicorn** | BSD | Include BSD license + copyright. |
| **Pydantic** | MIT | Include MIT license + copyright. |
| **OpenCV** (opencv-python-headless) | Apache 2.0 | Include Apache 2.0 license + any NOTICE. No patent claim from you. |
| **NumPy** | BSD | Include BSD license + copyright. |
| **Streamlit** | Apache 2.0 | Include Apache 2.0 license + NOTICE. |
| **boto3** (AWS SDK) | Apache 2.0 | Include Apache 2.0 license + NOTICE. |
| **python-dotenv** | BSD | Include BSD license + copyright. |
| **Ultralytics** (YOLO) | AGPL-3.0 | **Important:** AGPL requires that if you offer a network service using it, you must offer source of your app to users. Check [Ultralytics license](https://github.com/ultralytics/ultralytics/blob/main/LICENSE) and consider commercial license if you need different terms. |
| **pandas** | BSD | Include BSD license + copyright. |
| **lap** | BSD | Include BSD license + copyright. |

**Practical steps:**

1. **NOTICE or LICENSES file**  
   Add a file (e.g. `NOTICE` or `docs/THIRD_PARTY_LICENSES.md`) that lists these libraries and includes or links to their license texts and copyright lines.

2. **Ultralytics (YOLO)**  
   - If you use their code/weights in a **SaaS or web service**, AGPL can require making your modified source available to users.  
   - Options: use their **commercial license** if you don’t want to comply with AGPL, or ensure your use and distribution comply with AGPL (e.g. open-source your service or get legal advice).

3. **Custom-trained `best.pt`**  
   Trained weights from your own (or CF_Training) data are yours; the **training code/framework** (e.g. Ultralytics) still has its own license.

---

## 2. Pre-launch checklist (licenses and compliance)

Before launching the startup, consider the following. Laws depend on your country and region; treat this as a reminder list, not a full legal guide.

### 2.1 Business and registration

- [ ] **Business registration** (company, sole proprietorship, or equivalent in your jurisdiction).
- [ ] **Tax registration** (VAT, sales tax, etc. if applicable).
- [ ] **Business license / permits** (if required for your activity or location).

### 2.2 Intellectual property

- [ ] **Trademark** – Consider registering “CourtFlow” (or your product name) if you will use it commercially.
- [ ] **Ownership of code** – Clear agreements with co-founders, contractors, or university (e.g. TIE 204 / MVP Studio) on who owns the IP.
- [ ] **Third-party IP** – No use of others’ code, assets, or data without a license; OSS use as per their licenses (see section 1).

### 2.3 Data protection and privacy

- [ ] **Privacy policy** – Publish a privacy policy stating what data you collect (e.g. match videos, reports, user accounts if any), how you use it, and how long you keep it.
- [ ] **GDPR** (if you have users in the EU) – Legal basis, rights (access, deletion, etc.), data processing agreements if you use processors (e.g. cloud).
- [ ] **Other local laws** – e.g. CCPA (California), or national data protection laws.
- [ ] **Video and biometrics** – In some places, processing video of identifiable people can be “personal data” or “biometric”; check if you need consent or extra disclosures.

### 2.4 Content and media rights

- [ ] **Match video** – Who owns or licenses the video (club, league, user)? Do you have the right to process, store, and show analytics/highlights?
- [ ] **Terms of use** – Users must agree that they have the right to upload the video and grant you the rights needed to run the service (processing, storage, display of reports/highlights).
- [ ] **Highlights / clips** – If you generate clips from third-party footage, ensure your use is covered by license or terms.

### 2.5 Terms and contracts

- [ ] **Terms of Service** (or “Terms of Use”) for your product/website.
- [ ] **Acceptable use** – What users are not allowed to do (e.g. upload content they don’t own, misuse the service).
- [ ] **Liability and disclaimers** – Limits appropriate for your jurisdiction (drafted or reviewed by a lawyer).

### 2.6 Insurance and risk

- [ ] **Liability insurance** – Consider general or professional liability insurance for a startup offering a service.
- [ ] **Cyber / data breach** – Depending on what data you hold, consider whether cyber or data-breach coverage is needed.

### 2.7 Sector-specific

- [ ] **Sports / broadcasting** – If you work with leagues or broadcasters, check whether any sports rights or broadcasting rules apply.
- [ ] **Minors** – If match video may include minors, extra care on consent and data handling (e.g. under GDPR and local laws).

---

## 3. Summary table

| Area | Action |
|------|--------|
| **OSS licenses** | Add NOTICE/THIRD_PARTY_LICENSES; comply with each dependency (especially Ultralytics AGPL). |
| **Business** | Register business and tax; get any required permits. |
| **IP** | Clarify ownership; consider trademark. |
| **Privacy** | Privacy policy; comply with GDPR / local data law if applicable. |
| **Content** | Right to use match video; Terms of Service; acceptable use. |
| **Risk** | Terms, disclaimers, and (if appropriate) insurance. |

---

**Disclaimer:** This document is for informational purposes only and does not constitute legal, tax, or business advice. Laws and requirements vary by country and over time. Consult a qualified lawyer and (as needed) an accountant or business advisor before launching your startup.
