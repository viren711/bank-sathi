// English source content. Everything shown to the user is translated on demand by the server and cached.
// Scheme rates and limits change over time: always confirm at a bank, post office or the official website.

const TIPS = [
  "The bank never asks for your OTP, PIN or password on phone, message or WhatsApp.",
  "Do not click on links sent in messages saying your account will be closed.",
  "No one gives free money. Be careful of calls about lottery, prizes or KYC update.",
  "If someone is helping you at the ATM, do not tell them your PIN.",
  "If you are unsure, stop and call the bank on the number printed on your card or passbook.",
  "If you lose money to fraud, call 1930 at once or report at cybercrime.gov.in."
];

const WORDS = ["Nominee", "KYC", "Fixed Deposit", "Interest", "EMI", "Pension", "Passbook", "Cheque", "Overdraft", "Life certificate"];
const DOC_QUESTIONS = ["What is this document?", "Explain this in simple words", "What is my balance or amount?"];

const HOW_TO = [
  ["Choose your language", "Pick it from the list at the top, or tap a name in the moving strip. Every page changes to your language, with English kept above it."],
  ["Start from Home", "The Home page has big buttons for everything. The row of tabs under the header does the same. Your phone's back button also works."],
  ["Scan and Ask", "Take a photo of your passbook, form or any bank paper, or upload a file. No paper with you? Tap a sample. Then ask a question in your language."],
  ["Speak instead of typing", "Press the microphone button, speak, and press it again. Your words appear in the box. Check them, then press Ask."],
  ["Listen to answers", "Every answer is read aloud. Use Pause or Stop at the bottom of the screen. Moving to another page stops the voice."],
  ["Next Steps", "Describe your problem, add a photo if you have one, and get a simple list of what to do and what to carry to the bank."],
  ["Fill a Form", "Choose a form and the guide asks you one box at a time, in simple words. At the end you get a clean sheet to copy onto the real form."],
  ["Check a Message", "Paste an SMS you got and learn if it is a real bank message or a scam, and what to do next."],
  ["Government Schemes", "Read about pension, insurance, savings and loan schemes. Open any scheme and ask more about it."],
  ["Banking Words", "Tap a word like Nominee or KYC to get a simple explanation with an example."],
  ["Stay Safe", "Read short rules that protect your money. Never share your OTP or PIN with anyone."],
  ["Bigger letters", "Use the A+ button at the top to make letters bigger, and A- to make them smaller."]
];

// ---------- messages for the checker ----------
const SMS_SAMPLES = [
  { name: "Debit alert", sender: "VM-SMPLBK", text: "Rs 2,150.00 debited from A/c XX4821 on 11-Oct-26 to ELECTRICITY BOARD via UPI. Ref 628401935512. If not you, call the bank helpline. -SAMPLE BANK" },
  { name: "Pension credit", sender: "VM-SMPLBK", text: "Your A/c XX4821 is credited with Rs 18,500.00 on 01-Oct-26 (PENSION). Avl Bal Rs 46,062.00. -SAMPLE BANK" },
  { name: "OTP message", sender: "VK-SMPLBK", text: "482915 is your OTP for online transaction of Rs 5,000. Do not share it with anyone, including bank staff. Valid for 10 minutes. -SAMPLE BANK" },
  { name: "Fake KYC", sender: "+91 98123 45678", text: "Dear customer, your SAMPLE BANK account will be BLOCKED today. Update KYC immediately: http://smplbank-kyc.top/update or call 9876543210" },
  { name: "Lottery", sender: "", text: "Congratulations! You have won Rs 25,00,000 in the KBC lottery. Send your Aadhaar and bank details on WhatsApp 8877665544 to claim your prize." },
  { name: "Electricity cut", sender: "", text: "Your electricity will be disconnected tonight at 9:30 pm as your previous bill is not updated. Call officer 9123456780 immediately." },
  { name: "Refund trap", sender: "", text: "Refund of Rs 4,500 is pending for you. Enter your UPI PIN to receive the money in your account." },
  { name: "Easy loan", sender: "", text: "Pre-approved personal loan of Rs 5,00,000 at 0% interest. No documents needed. Click http://quick-cash.xyz/apply now, offer ends today!" },
  { name: "Statement ready", sender: "VM-SMPLBK", text: "Your SAMPLE BANK statement for September is ready. Visit your branch or open the bank app to view it." }
];

const VERDICT = {
  suspicious: { title: "Suspicious: this looks like a scam", icon: "alert", steps: ["Do not tap any link.", "Do not call any number in the message.", "Never share OTP, PIN or card details.", "Block the sender and tell a family member.", "If you lost money, call 1930 at once."] },
  bank: { title: "This looks like a normal bank message", icon: "check", steps: ["No action is needed unless you did not do this transaction.", "If you did not, call the bank on the number printed on your card or passbook.", "Even a real bank will never ask for your OTP or PIN."] },
  unsure: { title: "Not sure: be careful", icon: "alert", steps: ["Do not tap links or call numbers in the message.", "Check with your bank branch or the number on your card.", "Ask a family member before you do anything."] }
};

// ---------- form filling guides ----------
const FORMS = [
  {
    id: "account", title: "Open a savings account", desc: "New account opening form", sample: "account_opening_form.png",
    fields: [
      ["Name (as on Aadhaar)", "Write your full name exactly as printed on your Aadhaar card, in capital letters.", "RAMESH KUMAR SHARMA"],
      ["Date of birth", "Write the day, month and year in this order: DD-MM-YYYY.", "14-03-1958"],
      ["Gender", "Tick one box: Male, Female or Other.", "Male"],
      ["Mobile number", "Write the 10-digit number that stays with you. The bank sends OTPs and alerts here.", "98XXXXXXXX"],
      ["Aadhaar number", "Write the 12 digits from your Aadhaar card. Share it only with bank staff.", "XXXX XXXX 1234"],
      ["Address with PIN code", "Write your home address with the 6-digit PIN code, the same as on your Aadhaar.", "12 Ganesh Nagar, Pune 411030"],
      ["Nominee name", "The nominee is the person who gets the money if something happens to you, such as your wife, husband or child.", "SUNITA SHARMA"],
      ["Nominee relationship", "Write how the nominee is related to you.", "Wife"],
      ["Initial deposit (Rs)", "The money you give today to start the account. Ask the bank what the minimum is.", "1,000"],
      ["Debit (ATM) card", "Tick Yes if you want an ATM card. Tick No if you do not.", "Yes"],
      ["SMS alerts", "Tick Yes. You get a message for every deposit and withdrawal, which keeps you safe.", "Yes"],
      ["Signature", "Sign inside the box the same way every time. If you cannot write, give a thumb impression.", "(your signature)"]
    ]
  },
  {
    id: "loan", title: "Apply for a loan", desc: "Personal or Kisan loan application", sample: "loan_application.png",
    fields: [
      ["Full name of applicant", "Write your name exactly as on your Aadhaar card.", "RAMESH KUMAR SHARMA"],
      ["Father's or husband's name", "Write the full name of your father, or of your husband if you are a married woman.", "MOHAN LAL SHARMA"],
      ["Date of birth", "Write the day, month and year: DD-MM-YYYY.", "14-03-1958"],
      ["Aadhaar number", "The 12 digits on your Aadhaar card.", "XXXX XXXX 1234"],
      ["PAN number", "The 10-character code on your PAN card. If you have no PAN, ask the bank which form to use instead.", "ABCDE1234F"],
      ["Mobile number", "Your 10-digit number. The bank will call or message you here.", "98XXXXXXXX"],
      ["Residential address", "Your full home address with PIN code.", "12 Ganesh Nagar, Pune 411030"],
      ["Occupation or source of income", "Write how you earn money, such as farming, shop, pension or job.", "Farming"],
      ["Annual income (Rs)", "Your total income for one year, from all sources.", "1,80,000"],
      ["Loan amount required (Rs)", "Ask only for the amount you really need and can repay.", "50,000"],
      ["Purpose of loan", "Write what you will use the money for, such as seeds, shop stock, repairs or medical need.", "Buying seeds and fertiliser"],
      ["Repayment period (months)", "How many months you want to take to repay. A longer time means a smaller monthly payment, but more interest.", "24"],
      ["Existing loans, if any", "Write any loan you already have, with the lender name. Write NONE if you have no loan.", "NONE"],
      ["Bank account number", "The account where the loan money should come. It is printed in your passbook.", "XXXXXXXX4821"],
      ["Signature or thumb impression", "Sign or give a thumb impression below the declaration, and write today's date.", "(your signature)"]
    ]
  },
  {
    id: "deposit", title: "Deposit money (paying-in slip)", desc: "Slip to put cash or a cheque into an account", sample: null,
    fields: [
      ["Date", "Write today's date: DD-MM-YYYY.", "02-11-2026"],
      ["Account number", "The account where you want to put money. Check every digit against the passbook.", "XXXXXXXX4821"],
      ["Account holder name", "The name of the person who owns the account.", "RAMESH KUMAR SHARMA"],
      ["Amount in numbers", "Write the amount in figures and put a line after it so nobody can add digits.", "5,000/-"],
      ["Amount in words", "Write the same amount in words. It must match the numbers.", "Five thousand rupees only"],
      ["Cash or cheque", "Tick Cash if you give notes. Tick Cheque and write the cheque number if you give a cheque.", "Cash"],
      ["Your signature", "Sign at the bottom of the slip.", "(your signature)"]
    ]
  },
  {
    id: "life", title: "Pension life certificate", desc: "Yearly proof for pensioners that you are alive", sample: "pension_slip.png",
    fields: [
      ["Pensioner name", "Write your name exactly as in your pension papers.", "RAMESH KUMAR SHARMA"],
      ["PPO number", "The Pension Payment Order number. It is on your pension slip or PPO book.", "PPO/2011/448291"],
      ["Pension account number", "The bank account where your pension comes.", "XXXXXXXX4821"],
      ["Aadhaar number", "The 12 digits on your Aadhaar card. It is needed for Jeevan Pramaan.", "XXXX XXXX 1234"],
      ["Mobile number", "Your 10-digit number for messages.", "98XXXXXXXX"],
      ["Bank name and branch", "Write the bank and branch where you get your pension.", "Sample National Bank, Ganesh Nagar"],
      ["Date and signature", "Write today's date and sign. Carry your original Aadhaar and PPO to the bank. The due date is usually 30 November.", "(your signature)"]
    ]
  }
];

// ---------- official websites (each one was opened and answered, except where the note says otherwise) ----------
const GOV = {
  jansuraksha: "https://jansuraksha.gov.in/", pfrda: "https://www.pfrda.org.in/", post: "https://www.indiapost.gov.in/",
  nsi: "https://www.nsiindia.gov.in/", myscheme: "https://www.myscheme.gov.in/", cyber: "https://cybercrime.gov.in/"
};
const SCHEME_LINKS = {
  pmjdy: ["https://pmjdy.gov.in/"],
  apy: [GOV.jansuraksha, GOV.pfrda],
  pmsby: [GOV.jansuraksha],
  pmjjby: [GOV.jansuraksha],
  pmkisan: ["https://pmkisan.gov.in/"],
  kcc: ["https://agriwelfare.gov.in/", "https://www.nabard.org/"],
  svanidhi: ["https://pmsvanidhi.mohua.gov.in/"],
  mudra: ["https://mudra.org.in/"],
  ssy: [GOV.post, GOV.nsi],
  scss: [GOV.post, GOV.nsi],
  ppf: [GOV.post, GOV.nsi],
  pomis: [GOV.post, GOV.nsi],
  nps: ["https://npscra.proteantech.in/", GOV.pfrda],
  pmjay: ["https://pmjay.gov.in/"],        // could not be opened from the build machine; official domain of the scheme
  nsap: ["https://nsap.nic.in/"]           // could not be opened from the build machine; official domain of the scheme
};

// ---------- government schemes ----------
const SCHEMES = [
  { id: "pmjdy", tag: "Bank account", name: "PM Jan Dhan Yojana", short: "A bank account with no minimum balance, with a RuPay card and accident cover.",
    who: "Any Indian citizen aged 10 or above who has no bank account.",
    benefit: "Zero-balance savings account, free RuPay debit card, accident insurance cover of up to Rs 2 lakh with the card, and an overdraft facility of up to Rs 10,000 after good use of the account.",
    how: "Go to any bank branch or Bank Mitra with your documents and fill the account opening form.", docs: "Aadhaar, or another official ID. A photo." },
  { id: "apy", tag: "Pension", name: "Atal Pension Yojana", short: "A fixed monthly pension of Rs 1,000 to Rs 5,000 after age 60.",
    who: "Indian citizens aged 18 to 40 with a savings account. Income tax payers cannot join.",
    benefit: "You pay a small amount every month until age 60. From age 60 you get a guaranteed pension of Rs 1,000, 2,000, 3,000, 4,000 or 5,000 a month, as you choose. After you, your spouse gets the pension. The monthly amount you pay depends on your age when you join and the pension you choose. For example, joining at 18 for a Rs 1,000 pension costs about Rs 42 a month, and joining at 40 costs about Rs 291 a month.",
    how: "Ask your bank to open an APY account and allow auto-debit from your savings account.", docs: "Savings account, Aadhaar, mobile number." },
  { id: "pmsby", tag: "Insurance", name: "PM Suraksha Bima Yojana", short: "Accident insurance of Rs 2 lakh for just Rs 20 a year.",
    who: "Anyone aged 18 to 70 with a savings account.",
    benefit: "Rs 2 lakh on accidental death or full disability, and Rs 1 lakh on partial disability. The premium is Rs 20 a year, taken automatically from your account.",
    how: "Tell your bank to enrol you and keep Rs 20 in the account every year before 31 May.", docs: "Savings account, Aadhaar." },
  { id: "pmjjby", tag: "Insurance", name: "PM Jeevan Jyoti Bima Yojana", short: "Life insurance of Rs 2 lakh for Rs 436 a year.",
    who: "Anyone aged 18 to 50 with a savings account. Cover continues up to age 55.",
    benefit: "Rs 2 lakh to your family if you die from any cause. The premium is Rs 436 a year, taken from your account.",
    how: "Ask your bank to enrol you and keep the premium in your account every year before 31 May.", docs: "Savings account, Aadhaar." },
  { id: "pmkisan", tag: "Farmers", name: "PM Kisan Samman Nidhi", short: "Rs 6,000 a year in three payments for farmer families.",
    who: "Farmer families who own cultivable land. Some groups, such as income tax payers, are not eligible.",
    benefit: "Rs 6,000 a year, paid as Rs 2,000 three times a year straight into your bank account.",
    how: "Register at the common service centre, the village office or the PM Kisan portal. Complete e-KYC.", docs: "Aadhaar, land records, bank account, mobile number." },
  { id: "kcc", tag: "Farmers", name: "Kisan Credit Card", short: "Low-interest loans for farming needs.",
    who: "Farmers, tenant farmers, sharecroppers, and those who rear animals or fish.",
    benefit: "Easy short-term credit for seeds, fertiliser and other farm costs, with a subsidised interest rate. If you repay on time, the effective interest can be as low as about 4% on loans up to Rs 3 lakh.",
    how: "Apply at your bank branch or cooperative bank.", docs: "Land records, Aadhaar, photo, bank account." },
  { id: "svanidhi", tag: "Business", name: "PM SVANidhi", short: "Small loan for street vendors, starting at Rs 10,000.",
    who: "Street vendors who were selling before the scheme began, with a vendor certificate or letter of recommendation.",
    benefit: "A loan of Rs 10,000 without collateral. After you repay on time, you can get a bigger loan of Rs 20,000 and then Rs 50,000. You get an interest subsidy and a reward for using digital payments.",
    how: "Apply on the PM SVANidhi portal, at a common service centre or at a bank.", docs: "Vendor ID or recommendation letter, Aadhaar, bank account." },
  { id: "mudra", tag: "Business", name: "PM Mudra Yojana", short: "Loans for small shops and businesses without collateral.",
    who: "Small business owners, shopkeepers and self-employed people who are not in farming.",
    benefit: "Loans without collateral: Shishu up to Rs 50,000, Kishor up to Rs 5 lakh, and Tarun up to Rs 10 lakh or more.",
    how: "Apply at any bank, small finance bank or microfinance lender, or on the Udyamimitra portal.", docs: "Aadhaar, PAN, business proof, bank statement, photo." },
  { id: "ssy", tag: "Girl child", name: "Sukanya Samriddhi Yojana", short: "A savings account for a girl child with high interest and tax benefit.",
    who: "Parents or guardians of a girl below 10 years. One account per girl, usually up to two girls per family.",
    benefit: "You can deposit from Rs 250 to Rs 1.5 lakh a year for 15 years. The account matures when the girl is 21. Interest is higher than most savings schemes and the money is tax-free. Part can be withdrawn at 18 for study or marriage.",
    how: "Open at a post office or authorised bank with the girl's birth certificate.", docs: "Girl's birth certificate, parent's ID and address proof, photo." },
  { id: "scss", tag: "Senior citizens", name: "Senior Citizens Savings Scheme", short: "A safe 5-year deposit for people aged 60 and above, with interest every quarter.",
    who: "Citizens aged 60 or more. Retired people aged 55 to 60 can join under some conditions.",
    benefit: "Deposit up to Rs 30 lakh for 5 years, which can be extended by 3 years. Interest is paid every three months at a rate set by the government, which is usually better than a bank FD. The deposit saves income tax under Section 80C.",
    how: "Open at a post office or authorised bank.", docs: "Age proof, Aadhaar, PAN, photo, address proof." },
  { id: "ppf", tag: "Savings", name: "Public Provident Fund (PPF)", short: "A 15-year tax-free savings account backed by the government.",
    who: "Any Indian resident. One account per person.",
    benefit: "Deposit from Rs 500 up to Rs 1.5 lakh a year. The account runs for 15 years, with an interest rate set by the government every quarter. Deposit, interest and maturity are all tax-free. Partial withdrawal is allowed from the 7th year.",
    how: "Open at a post office or a bank.", docs: "Aadhaar, PAN, photo, nominee details." },
  { id: "pomis", tag: "Savings", name: "Post Office Monthly Income Scheme", short: "Put money once and get interest every month for 5 years.",
    who: "Any Indian resident adult, or a guardian for a child.",
    benefit: "Deposit up to Rs 9 lakh in a single account or Rs 15 lakh in a joint account. You get interest every month for 5 years, then your money back.",
    how: "Open at any post office.", docs: "Aadhaar, PAN, photo, address proof." },
  { id: "nps", tag: "Pension", name: "National Pension System (NPS)", short: "Save for retirement and get a pension later, with tax benefits.",
    who: "Indian citizens aged 18 to 70.",
    benefit: "You invest regularly from as little as Rs 1,000 a year. At age 60, part of the money comes as a lump sum and the rest as monthly pension. You get income tax savings.",
    how: "Open through a bank, a post office or the eNPS website.", docs: "Aadhaar or PAN, bank account, photo." },
  { id: "pmjay", tag: "Health", name: "Ayushman Bharat PM-JAY", short: "Free hospital treatment up to Rs 5 lakh a year for eligible families.",
    who: "Families listed as eligible under the scheme. All citizens aged 70 and above can also get cover, whatever their income.",
    benefit: "Cashless treatment up to Rs 5 lakh per family per year at listed government and private hospitals.",
    how: "Check eligibility on the PM-JAY website or at a Common Service Centre or hospital Ayushman Mitra. Get your Ayushman card made.", docs: "Aadhaar, ration card or family proof, mobile number." },
  { id: "nsap", tag: "Senior citizens", name: "Old Age Pension (NSAP)", short: "A monthly pension from the government for poor elderly people.",
    who: "Elderly people aged 60 or above who live below the poverty line.",
    benefit: "A monthly pension paid into your bank account. The central amount is small, and many state governments add more, so the total differs by state.",
    how: "Apply at the gram panchayat, the block or municipal office, or your state's pension portal.", docs: "Age proof, BPL proof, Aadhaar, bank account, photo." }
];
