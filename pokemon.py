import requests
from bs4 import BeautifulSoup as bs
import pandas as pd
import streamlit as st

st.set_page_config(page_title="Pokedex App")

web_url = "https://pokemondb.net/pokedex/all"

response = requests.get(web_url)

if response.status_code == 200:

    parsed_content = bs(response.text, "html.parser")

    table = parsed_content.find("table", id="pokedex")
    table_body = table.tbody

    list_of_rows = table_body.find_all("tr")

    pokedex = []

    for row in list_of_rows:
        stats = {}

        name_row = row.find("td", class_="cell-name")
        stats["name"] = name_row.a.text.strip()

        num_rows = row.find_all("td", class_="cell-num")

        stats["total"] = num_rows[1].text
        stats["HP"] = num_rows[2].text
        stats["phAtk"] = num_rows[3].text
        stats["phDef"] = num_rows[4].text
        stats["spAtk"] = num_rows[5].text
        stats["spDef"] = num_rows[6].text
        stats["speed"] = num_rows[7].text

        pokedex.append(stats)

    pokedex_df = pd.DataFrame(pokedex)

    st.sidebar.title("Search for a Pokémon")

    pokemon_choice = st.sidebar.selectbox(
        "Pokemon",
        ["All"] + sorted(list(pokedex_df["name"].unique()))
    )

    st.title("Pokédex App")

    if pokemon_choice == "All":
        filtered_df = pokedex_df
    else:
        filtered_df = pokedex_df[pokedex_df["name"] == pokemon_choice]

    st.dataframe(filtered_df)

else:
    st.error("Could not load Pokémon data from the website.")