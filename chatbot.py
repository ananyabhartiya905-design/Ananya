import streamlit as st
from google import genai
import datetime

client = genai.Client(api_key="GEMINI_API_KEY")

st.set_page_config(page_title="Weather Boy AI", page_icon="🌦️")

st.title("🌦️ Weather Boy AI Chatbot 🤖")

if "chat" not in st.session_state:
    st.session_state.chat = client.chats.create(model="gemini-1.5-pro")

# simple fake weather system (so app ALWAYS works)
def get_weather(city):
    weather_data = {
        "delhi": "☀️ Sunny, 34°C",
        "mumbai": "🌧️ Rainy, 28°C",
        "lucknow": "⛅ Cloudy, 30°C",
        "default": "🌤️ Mild weather, 29°C"
    }
    return weather_data.get(city.lower(), weather_data["default"])

user_input = st.chat_input("Ask me anything (try: weather in Delhi)")

if user_input:

    st.chat_message("user").write(user_input)

    if "weather" in user_input.lower():
        city = user_input.lower().replace("weather in", "").strip()
        reply = f"🌦️ Weather Boy says: {get_weather(city)}"

    else:
        # GEMINI RESPONSE
        response = st.session_state.chat.send_message(user_input)
        reply = response.text

    st.chat_message("assistant").write(reply)