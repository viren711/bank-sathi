import os

from dotenv import load_dotenv
from sarvamai import SarvamAI

load_dotenv()

client = SarvamAI(api_subscription_key=os.environ["SARVAM_API_KEY"])

response = client.chat.completions(
    model="sarvam-105b",
    messages=[{"role": "user", "content": "Say hello in Hindi, in one sentence."}]
)
print(response.choices[0].message.content)
