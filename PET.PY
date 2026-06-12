import time 
pet_name = input("What is your pet's name?")
hunger = 5
happiness = 5
while True:
    print("\n---", pet_name,"---")
    print("Hunger:" , hunger)
    print("Happiness", happiness)

    print("\n1. Feed Pet")
    print("2. Play with Pet")
    print("3. Check Status")
    print("4. Exit")
    choice = input("Choose an option:")
    if choice == "1":
        hunger-= 2 
        if hunger<0:
                hunger = 0
        print(pet_name, "is eating!")
    elif choice == "2":
            happiness += 2
            print("You played with", pet_name)
    elif choice == "3":
            print("\nStatus Report")
            print("Hunger:", hunger)
            print("Happiness:", happiness)
    elif choice == "4":
            print("Goodbye!!")
    else:
            print("Invalid choice!")
    hunger += 1
    happiness -= 1
    if happiness < 0:
            happiness = 0
    if hunger >= 10:
            print("\nOh no! Your pet is too hungry!")
    if happiness == 0:
            print("\n Your pet is very sad!")
            break
    time.sleep(1)
