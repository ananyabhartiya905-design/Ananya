import streamlit as st
import requests

API_KEY = "YOUR_API_KEY"

st.title("🌤️ Weather Bot")

city = st.text_input("Enter City Name")

if st.button("Get Weather"):

    url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={API_KEY}&units=metric"

    response = requests.get(url)

    if response.status_code == 200:

        data = response.json()

        temp = data["main"]["temp"]
        humidity = data["main"]["humidity"]
        wind = data["wind"]["speed"]
        weather = data["weather"][0]["description"]
        icon = data["weather"][0]["icon"]

        st.success(f"Weather in {city}")

        st.image(
            f"https://openweathermap.org/img/wn/{icon}@2x.png"
        )

        st.write(f"🌡 Temperature: {temp} °C")
        st.write(f"💧 Humidity: {humidity}%")
        st.write(f"💨 Wind Speed: {wind} m/s")
        st.write(f"☁ Condition: {weather}")

    else:
        st.error("City not found")