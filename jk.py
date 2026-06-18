text = input("Enter text: ")
unwanted_char = ["\n", "\t",",/","/,",",","."]
for char in unwanted_char:
    text = text.replace(char,"")
text = text.strip()
text = text.lower()
print(f"clean text {text}")

letter_frequency = {}
for letter in text:
    letter_frequency[letter] = text.count(letter)

print(f"Letter frequencies = {letter_frequency}")
