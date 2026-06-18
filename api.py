import pandas as pd

df = pd.read_csv("students.csv")

print("Average Marks:")
print(df.mean(numeric_only=True))

print("\nTop Student:")
print(df.loc[df["Total"].idxmax()])