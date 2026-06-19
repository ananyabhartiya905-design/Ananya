import streamlit as st
import google.genai as genai

API_KEY = st.secrets["GEMINI_API_KEY"]

client = genai.Client(api_key=API_KEY)

st.title("🤖 Gemini Fun Fact Bot")

topic = st.text_input("Enter a topic:", "RC fighter jets")

if st.button("Get Fun Fact"):
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"Tell me a fun fact about {topic}. Keep it short and simple."
        )

        st.success(response.text)

    except Exception as e:
        st.error(f"Error: {e}")