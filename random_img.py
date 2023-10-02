import os
import json

def rename_and_convert_to_json(directory):
    # Get list of files in the directory with .jpg, .jpeg, .png extensions
    files = [f for f in os.listdir(directory) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]

    # Sort the files (optional, but ensures a predictable renaming sequence)
    files.sort()

    # Rename files to the new naming convention
    for index, filename in enumerate(files, start=1):
        old_path = os.path.join(directory, filename)
        new_name = f"IMG_{index}.jpg"  # assuming you want to keep the .jpg extension for all renamed files
        new_path = os.path.join(directory, new_name)
        os.rename(old_path, new_path)

    # Create a list of the new file paths
    new_files = [f"photos2/{f}" for f in os.listdir(directory) if f.lower().startswith('img_')]

    # Save to photos2.json
    with open('photos2.json', 'w') as json_file:
        json.dump(new_files, json_file, indent=4)

if __name__ == "__main__":
    rename_and_convert_to_json("photos2")
