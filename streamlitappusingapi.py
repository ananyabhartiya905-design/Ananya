import streamlit as st
import requests

st.title("😂 Joke Generator")

if st.button("Generate Joke"):
    response = requests.get(
        "https://official-joke-api.appspot.com/random_joke"
    )

    joke = response.json()

    st.write("### " + joke["setup"])
    st.success(joke["punchline"])