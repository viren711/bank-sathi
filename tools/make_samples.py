from PIL import Image, ImageDraw, ImageFont
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static", "samples") + os.sep
R = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
B = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
M = "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"
HI = "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf"
f = lambda p, s: ImageFont.truetype(p, s)

def page(w, h, bg, bar, title, sub, hi=None):
    im = Image.new("RGB", (w, h), bg); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, w, 110], fill=bar)
    d.text((40, 22), title, font=f(B, 40), fill="white")
    d.text((40, 70), sub, font=f(R, 22), fill="#e8f1ff")
    if hi: d.text((w - 40, 30), hi, font=f(HI, 36), fill="white", anchor="ra")
    return im, d

# 1. Passbook
im, d = page(900, 1000, "#fffdf5", "#12467a", "SAMPLE NATIONAL BANK", "SAVINGS ACCOUNT PASSBOOK  (specimen)", "सैंपल राष्ट्रीय बैंक")
rows = [("Account holder", "RAMESH KUMAR SHARMA"), ("Account no.", "XXXXXXXX4821"), ("Branch", "Ganesh Nagar, Pune"), ("IFSC", "SMPL0001234"), ("Nominee", "SUNITA SHARMA (Wife)")]
y = 140
for k, v in rows:
    d.text((40, y), k + ":", font=f(R, 26), fill="#444"); d.text((300, y), v, font=f(B, 26), fill="#111"); y += 44
y += 20
cols = [40, 170, 430, 570, 720]
d.rectangle([30, y, 870, y + 44], fill="#dbe7f5")
for x, t in zip(cols, ["Date", "Particulars", "Debit", "Credit", "Balance"]): d.text((x, y + 8), t, font=f(B, 24), fill="#12467a")
data = [("02-09-26", "PENSION CREDIT", "", "18,500.00", "42,300.00"), ("05-09-26", "ATM WITHDRAWAL", "5,000.00", "", "37,300.00"),
        ("11-09-26", "ELECTRICITY BILL", "2,150.00", "", "35,150.00"), ("18-09-26", "INTEREST CREDIT", "", "412.00", "35,562.00"),
        ("22-09-26", "CHEQUE 004512", "8,000.00", "", "27,562.00"), ("01-10-26", "PENSION CREDIT", "", "18,500.00", "46,062.00"),
        ("07-10-26", "ATM WITHDRAWAL", "10,000.00", "", "36,062.00"), ("15-10-26", "FD INTEREST", "", "1,725.00", "37,787.00"),
        ("24-10-26", "MEDICAL STORE UPI", "1,340.00", "", "36,447.00")]
y += 56
for r in data:
    for x, t in zip(cols, r): d.text((x, y), t, font=f(M, 22), fill="#111")
    d.line([30, y + 34, 870, y + 34], fill="#e3e3e3"); y += 46
d.text((40, 930), "Closing balance as on 24-10-2026:  Rs 36,447.00", font=f(B, 28), fill="#12467a")
im.save(OUT + "passbook.png")

# 2. Fixed deposit receipt
im, d = page(900, 700, "#fffaf0", "#7a3b12", "SAMPLE CO-OPERATIVE BANK", "FIXED DEPOSIT RECEIPT  (specimen)", "सावधि जमा रसीद")
rows = [("FD number", "FD/2026/009317"), ("Depositor", "SUNITA SHARMA"), ("Deposit amount", "Rs 1,00,000.00"), ("Date of deposit", "12-08-2026"),
        ("Tenure", "2 years (24 months)"), ("Interest rate", "7.25% per annum"), ("Maturity date", "12-08-2028"), ("Maturity amount", "Rs 1,15,600.00 (approx.)"),
        ("Interest payout", "Cumulative, paid at maturity"), ("Premature closure", "1% penalty on interest rate"), ("Nominee", "RAMESH KUMAR SHARMA")]
y = 140
for k, v in rows:
    d.text((50, y), k + ":", font=f(R, 27), fill="#444"); d.text((380, y), v, font=f(B, 27), fill="#111"); y += 47
d.text((50, 665), "Please carry this receipt and photo ID at maturity.", font=f(R, 20), fill="#7a3b12")
im.save(OUT + "fixed_deposit.png")

# 3. Loan application form
im, d = page(900, 1100, "white", "#1d6b3a", "SAMPLE GRAMIN BANK", "PERSONAL / KISAN LOAN APPLICATION FORM  (specimen)", "ऋण आवेदन पत्र")
fields = ["1. Full name of applicant", "2. Father / Husband's name", "3. Date of birth", "4. Aadhaar number", "5. PAN number", "6. Mobile number",
          "7. Residential address", "8. Occupation / Source of income", "9. Annual income (Rs)", "10. Loan amount required (Rs)",
          "11. Purpose of loan", "12. Repayment period (months)", "13. Existing loans, if any", "14. Bank account number"]
y = 140
for t in fields:
    d.text((40, y), t, font=f(R, 25), fill="#222"); d.line([470, y + 30, 860, y + 30], fill="#555", width=2); y += 52
d.rectangle([40, y + 10, 860, y + 120], outline="#1d6b3a", width=3)
d.text((55, y + 20), "Declaration: I declare that the information given above is true.", font=f(R, 22), fill="#222")
d.text((55, y + 60), "Signature / Thumb impression: ____________     Date: ___/___/______", font=f(R, 22), fill="#222")
d.text((40, y + 140), "Documents needed: Aadhaar, PAN, 2 photos, land record / income proof.", font=f(R, 20), fill="#1d6b3a")
im.save(OUT + "loan_application.png")

# 4. Account opening form
im, d = page(900, 1000, "white", "#5b2a86", "SAMPLE NATIONAL BANK", "NEW SAVINGS ACCOUNT OPENING FORM  (specimen)", "खाता खोलने का फॉर्म")
fields = ["Name (as per Aadhaar)", "Date of birth", "Gender", "Mobile number", "Aadhaar number", "Address with PIN code",
          "Nominee name", "Nominee relationship", "Initial deposit (Rs)", "Do you want a debit card?  Yes / No", "Do you want SMS alerts?  Yes / No"]
y = 140
for t in fields:
    d.text((40, y), t, font=f(R, 26), fill="#222"); d.line([420, y + 32, 860, y + 32], fill="#555", width=2); y += 58
d.text((40, y + 20), "Applicant signature: ____________________      Photo", font=f(R, 24), fill="#222")
d.rectangle([700, y + 5, 860, y + 130], outline="#5b2a86", width=3)
d.text((40, y + 80), "KYC: attach self-attested Aadhaar copy and one photo.", font=f(R, 20), fill="#5b2a86")
im.save(OUT + "account_opening_form.png")

# 5. Pension slip
im, d = page(900, 800, "#f7fbff", "#0f5a5a", "SAMPLE PENSION DISBURSING OFFICE", "MONTHLY PENSION SLIP  (specimen)", "पेंशन पर्ची")
rows = [("Pensioner", "RAMESH KUMAR SHARMA"), ("PPO number", "PPO/2011/448291"), ("Month", "October 2026"), ("Basic pension", "Rs 15,200.00"),
        ("Dearness relief (DR)", "Rs 6,688.00"), ("Medical allowance", "Rs 1,000.00"), ("Income tax deducted", "Rs 0.00"),
        ("Net pension credited", "Rs 22,888.00"), ("Credited to a/c", "XXXXXXXX4821"), ("Life certificate due", "By 30 November 2026")]
y = 140
for k, v in rows:
    d.text((50, y), k + ":", font=f(R, 27), fill="#444"); d.text((400, y), v, font=f(B, 27), fill="#111"); y += 52
d.text((50, 740), "Submit your Jeevan Pramaan / life certificate every year to continue pension.", font=f(R, 20), fill="#0f5a5a")
im.save(OUT + "pension_slip.png")
print("done")
