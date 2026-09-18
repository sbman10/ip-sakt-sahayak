# IP-SAKTI Sahayak — User Experience Report (Hinglish)
### User ki nazar se: Kya achha nahi lagega, kya hona chahiye, aur layman kaise chalayega

> **Ye document kis liye hai:** Agar koi bilkul naya user (ya SIH judge) hamari website par pehli baar aata hai, to usko kya-kya problem hogi, kaunse features add karne se "maza aa jayega", aur jise IP ka kuch nahi pata wo banda site kaise use karega — ye sab is document me saaf-saaf samjhaya gaya hai.

---

## 📑 Index (Table of Contents)

1. Website abhi kaisi hai (short summary)
2. PART A — User ko kya-kya **ACHHA NAHI** lagega (pain points)
3. PART B — "Agar ye bhi hota to **MAZA AA JATA**" (missing wow-features)
4. PART C — **Layman** banda (jise kuch nahi aata) kaise site chalayega
5. Priority table (kaunsa fix pehle, kitni mehnat, kitna fayda)
6. Final summary

---

## 1. Website abhi kaisi hai (short summary)

IP-SAKTI Sahayak ek **AI-powered legal assistant** hai jo Ayurveda practitioners aur startups ko IP (patent, trademark, GI), regulatory aur biodiversity-compliance ke sawaalon ka **citation ke saath, sarkari documents se grounded jawab** deta hai.

Abhi website me ye sab hai:
- **AI Chat** (sawaal poochho, jawab + sources milte hain)
- **Fee Calculator** aur **Deadline Calculator** (free tools)
- **Draft Generator** (patent/NBA/opposition ke draft banao)
- **Matter Workspace** (apne IP cases track karo)
- **Document Upload, Filing Checklists, Expert Connect, Pricing**
- 10 languages, voice input, DPDP privacy badge

**Problem:** Feature bahut hain, par **naya user confuse ho jata hai** — kyunki koi guide/tour nahi hai. Neeche detail me.

---

## PART A — User ko kya-kya ACHHA NAHI lagega 😖

### A1. First-time user "lost" ho jayega
- Website kholte hi 8-10 features ek saath saamne aa jaate hain — Chat, Drafts, Workspace, Documents, Checklists, Experts, 2 Calculators.
- **Koi nahi batata "shuru kahan se karun".** Koi welcome tour ya onboarding nahi hai (code me confirm kiya — bilkul absent).
- Jise IP ka A-B-C nahi pata wo sochega: *"Patent? Trademark? GI? Main kya select karun?"* — koi madad nahi milti.
- **Nateeja:** User ghabra ke website chhod sakta hai.

### A2. Chatbot slow hai
- Pehla sawaal poochne pe backend ko AI model load karna padta hai → **10-20 second ka wait**.
- Aam user itna wait nahi karega — "site hang ho gayi" samajh ke chala jayega.
- (Ye humara purana confirmed issue hai — pehli query slow rehti hai.)

### A3. Login ki deewar bahut jaldi aa jaati hai
- Drafts, Workspace, Documents, Experts — ye sab **login-required** hain.
- Naya user bina kuch try kiye seedha login screen dekhe to bhaag sakta hai.
- **Sahi tareeka:** "Pehle value dikhao, phir login maango" — abhi ulta ho raha hai.

### A4. Citations (Sources) expand khaali dikhta hai
- User jawab ke neeche "Sources" pe click kare aur **khaali** dikhe → trust turant toot jaata hai.
- Ye demo me judge ko bhi dikhega — sabse zaroori trust-feature hai jo abhi tootel hai.

### A5. Jargon (mushkil shabd) ki bharmaar
- "Section 3(p)", "TKDL", "ABS compliance", "Nagoya Protocol" — bina simple explanation ke.
- Layman ke liye ye Greek jaisa hai. Ek chhoti si tooltip/explanation honi chahiye.

---

## PART B — "Agar ye bhi hota to MAZA AA JATA" ✨

### B1. Guided Onboarding Tour (sabse zaroori)
**Kya hai:** Pehli baar site kholne pe ek chhota interactive tour — jaise mobile app me naya feature aane pe highlight aata hai.

**Kaisa dikhega:** Screen thodi dim, aur ek-ek karke box highlight honge with arrow + text:
- Step 1 → Chat box: *"Yahan apna sawaal likho ya bolo 🎤"*
- Step 2 → Jurisdiction dropdown: *"Yahan chuno — India ka kanoon, International, ya dono"*
- Step 3 → Answer area: *"Jawab ke neeche 'Sources' pe click karke asli sarkari document dekho"*
- Step 4 → Tools: *"Fee/Deadline calculator yahan hai"*
- "Skip" aur "Next" button honge.

**Kaam kaise karega:** Browser me ek chhota flag save hoga — ek baar tour dekh liya to dobara nahi aayega. Ek "Replay tour" button help section me rahega.

---

### B2. "Main naya hun, meri madad karo" Wizard
**Kya hai:** Ek friendly 3-sawaal ka wizard jo layman ko bataye usko **kaunsa IP chahiye** — kyunki usko patent/trademark/GI me farak nahi pata.

**Kaisa dikhega:** Ek card jaisa quiz:
- Q: *"Aap kya bana rahe ho?"* → [Herbal product] [Mobile app] [Research/Formula] [Brand/Logo]
- User "Herbal product" chune → agla: *"Kya ye nayi formula hai ya purani jaankari pe based?"*
- Ant me result: *"Aapko chahiye: **Patent** (nayi cheez ke liye) + **ABS compliance** (biodiversity). Yahan checklist khol 👉"*

**Kaam kaise karega:** Pura simple logic (if-else), koi AI nahi — instant aur fast. Answer ke ant me direct chat/checklist/calculator ka button.

---

### B3. Suggested Question Chips (clickable prompts)
**Kya hai:** Chat kholte hi 4-5 clickable buttons — user ko sochna/type nahi karna.

**Kaisa dikhega:** Chat box ke upar chips:
`[Can I patent neem?]  [Ayurvedic product ka trademark kaise?]  [TKDL kya hai?]  [Patent fees kitni?]`

**Kaam kaise karega:** Chip pe click → wahi sawaal apne aap chat me chala jaata hai. Chhota kaam, bada impact.

---

### B4. Voice + Regional Language ko prominent karna
**Kya hai:** Mic button aur "Hindi me poochho" abhi hai par chhota/chhupa hua hai. Ise bada aur colorful, saamne laana.

**Kaisa dikhega:** Chat ke paas ek bada pill button: *"🎤 हिंदी में बोलें"* — rural/non-English user ko turant dikhe ki wo apni bhasha me bol sakta hai.

**Kaam kaise karega:** Jo voice feature already bana hai wahi use hoga, bas UI ko prominent banana hai.

---

### B5. Draft ka "Next Step" (dead-end fix)
**Kya hai:** Abhi draft banne ke baad kuch nahi hota — user soch me pad jaata hai "ab kya karun".

**Kaisa dikhega:** Draft ready hote hi neeche buttons:
`[📥 Download PDF]  [📋 Copy karo]  [➡️ Agla kadam: Filing checklist khol]`

---

### B6. Har jawab ke neeche "Ab kya karun?" button
**Kya hai:** Chatbot jawab de, uske neeche ek smart next-action button.

**Kaisa dikhega:** Neem patent ka jawab aaya → neeche:
`[📝 Patent draft banao]  [✅ Filing checklist]  [💰 Fees calculate karo]`

**Kaam kaise karega:** Jawab ke topic ke hisaab se relevant button dikhega.

---

## PART C — Layman banda (jise kuch nahi aata) kaise chalayega 🧓

**Abhi:** Mushkil se — kyunki koi guide nahi hai. Isko theek karne ke liye ye 4 cheezein daalni padengi:

### C1. Home pe bada "Kaise shuru karun?" button
**Kya hai:** Hero section me ek bada button jo 3-step simple visual khole.

**Kaisa dikhega:** Click pe ek saaf card:
> **1️⃣ Sawaal poochho  →  2️⃣ Jawab + Sarkari source paao  →  3️⃣ Draft/Checklist banao**

Har step ka chhota icon + 1 line explanation.

### C2. Har page pe "?" help icon
**Kya hai:** Har page ke corner me chhota ⓘ / ? icon.

**Kaisa dikhega:** Hover/click pe 1-line: *"Ye page aapke saare IP cases track karta hai."* → Confusion khatam.

### C3. Friendly Empty States
**Kya hai:** Jaha data khaali hai (naya user ka Workspace, Documents), waha bekaar khaali screen ke bajaye friendly message + button.

**Kaisa dikhega:** Khaali workspace pe:
> *"📁 Yahan aapke patent/trademark cases dikhenge. Pehla case add karein 👉 [+ Naya Case]"*

### C4. Jargon Tooltips (plain-language)
**Kya hai:** TKDL, Section 3(p), ABS, Nagoya jaise mushkil shabd pe hover karne pe simple matlab.

**Kaisa dikhega:** "TKDL" pe hover →
> *"Traditional Knowledge Digital Library — purani Ayurvedic jaankari ka sarkari record, jo galat patent rokta hai."*

---

## 5. Priority Table — kaunsa pehle karein

| # | Feature / Fix | Fayda (Impact) | Mehnat (Effort) | Login chahiye? |
|---|---------------|----------------|-----------------|----------------|
| 1 | Suggested question chips | 🔥🔥🔥 Bahut zyada | Chhota | Nahi |
| 2 | "Kaise shuru karun" 3-step visual | 🔥🔥🔥 Bahut zyada | Chhota | Nahi |
| 3 | Har jawab pe "Ab kya karun" button | 🔥🔥🔥 Bahut zyada | Chhota-Medium | Nahi |
| 4 | Citations empty bug fix (trust) | 🔥🔥🔥 Bahut zyada | Chhota-Medium | Nahi |
| 5 | Jargon tooltips | 🔥🔥 Zyada | Chhota-Medium | Nahi |
| 6 | Guided onboarding tour | 🔥🔥🔥 Bahut zyada | Medium | Nahi |
| 7 | "Main naya hun" wizard | 🔥🔥 Zyada | Medium | Nahi |
| 8 | Empty states + help icons | 🔥🔥 Zyada | Chhota | Nahi |
| 9 | Voice button prominent | 🔥 Thoda | Chhota | Nahi |
| 10 | Draft next-step buttons | 🔥🔥 Zyada | Chhota | Haan |
| 11 | Login deewar kam karo (guest chat) | 🔥🔥 Zyada | Medium | — |
| 12 | Chat speed / streaming | 🔥🔥 Zyada | Medium-Bada | — |

**Note:** Points 1-10 sab **frontend (client-side)** hain — RAM/backend pe load nahi, isliye 6GB laptop pe safe. Quick-wins (1, 2, 3) pehle karne se demo turant behtar dikhega.

---

## 6. Final Summary (ek line me)

> Abhi website **feature-rich** hai par **naya user friendly nahi** — sabse bada gap hai **guidance ka** (koi tour/help/suggested-questions nahi). Agar hum **onboarding tour + suggested chips + "ab kya karun" buttons + jargon tooltips + empty states** add kar dein, to layman bhi asaani se site chala payega aur judge ko "polished, thoughtful product" lagega.

---

*Document banaya gaya: IP-SAKTI Sahayak (SIH 2026, PS 26045) — user-experience audit, actual code padhkar.*
