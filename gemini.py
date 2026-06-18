from google import genai
import streamlit as st

API_KEY = st.secrets["GEMINI_API_KEY"]

client = genai.Client(api_key=API_KEY)

def get_fun_fact(topic: str):
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"Tell me a fun fact about {topic}. Keep it short and simple."
        )
        return response.text

    except Exception as e:
        return f"Error: {e}"


if __name__ == "__main__":
    topic = "RC fighter jets"
    fact = get_fun_fact(topic)
    print("🤖 Fun Fact:\n", fact)