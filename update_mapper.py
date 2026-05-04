import re

with open('src/integrations/googleSheets/mapper.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if 'functionCode: "EwA"' in line:
        line = line.replace('functionCode: "EwA"', 'functionCode: "EwA & BD"')
    elif 'functionCode: "BD"' in line:
        if 'Conference' in line:
            line = line.replace('functionCode: "BD"', 'functionCode: "Conference"')
        elif 'Overhead' in line:
            line = line.replace('functionCode: "BD"', 'functionCode: "NMF"')
        else:
            line = line.replace('functionCode: "BD"', 'functionCode: "EwA & BD"')
    new_lines.append(line)

with open('src/integrations/googleSheets/mapper.ts', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Mapper updated successfully.")
