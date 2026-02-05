# CSV Dictionary Import/Export

LexiLens supports importing and exporting your custom dictionaries as CSV files. This is useful for:

- **Personal dictionaries** - Your commonly used words and terms
- **Company dictionaries** - Brand names, product names, internal jargon
- **Team sharing** - Export and share dictionaries with colleagues
- **Backup** - Save your dictionary and restore it later

## CSV Format

The CSV file should have two columns:

```csv
word,type
```

### Supported Types

1. **`word`** - Regular words to ignore (jargon, slang, etc.)
   - Example: `gonna,word`

2. **`entity`** - Named entities (names, companies, acronyms)
   - Example: `GitHub,entity`
   - Example: `NASA,entity`

3. **`homophone`** - Validated homophones you've confirmed
   - Example: `their,homophone`
   - Example: `you're,homophone`

### Example CSV File

```csv
word,type
API,entity
GitHub,entity
JavaScript,entity
React,entity
TypeScript,entity
their,homophone
there,homophone
they're,homophone
your,homophone
you're,homophone
its,homophone
it's,homophone
jargon,word
slang,word
gonna,word
wanna,word
CEO,entity
NASA,entity
UNESCO,entity
```

## How to Import

1. Open the LexiLens popup (click the extension icon)
2. Scroll to **"My Dictionary"** section
3. Click **"📥 Import CSV"**
4. Select your CSV file
5. LexiLens will automatically categorize words based on the `type` column

### What Happens During Import

- Words are automatically sorted into the correct dictionary category
- Duplicate words are skipped (won't add the same word twice)
- Invalid rows are ignored
- A success message shows how many words were imported

## How to Export

1. Open the LexiLens popup
2. Scroll to **"My Dictionary"** section
3. Click **"📤 Export CSV"**
4. A file will be downloaded: `lexilens-dictionary-YYYY-MM-DD.csv`

### What's Included in Export

The export includes ALL your dictionary entries:
- All ignored words (type: `word`)
- All verified entities (type: `entity`)
- All validated homophones (type: `homophone`)

## Use Cases

### 1. Personal Dictionary
Create a CSV with words you commonly use:
```csv
word,type
y'all,word
ain't,word
gonna,word
wanna,word
```

### 2. Company/Brand Dictionary
Share company-specific terms with your team:
```csv
word,type
Acme Corp,entity
CloudSync,entity
DataFlow,entity
TechStack,entity
API,entity
SDK,entity
```

### 3. Technical Writing Dictionary
For developers and technical writers:
```csv
word,type
JavaScript,entity
TypeScript,entity
React,entity
Vue,entity
Angular,entity
API,entity
JSON,entity
HTML,entity
CSS,entity
async,word
await,word
const,word
```

### 4. Academic/Professional Dictionary
Field-specific terminology:
```csv
word,type
aforementioned,word
herein,word
thereof,word
UNESCO,entity
UNICEF,entity
WHO,entity
PhD,entity
MBA,entity
```

## Tips

1. **Keep it organized** - Use meaningful type labels for easier management
2. **Backup regularly** - Export your dictionary periodically
3. **Share with team** - Export and share with colleagues who use LexiLens
4. **Start small** - Import 10-20 words first to test, then add more
5. **No quotes needed** - Simple format: `word,type` (quotes are optional)

## Advanced CSV Format

You can also use quoted values if your words contain commas:

```csv
word,type
"Hello, World",word
"Smith, John",entity
```

## Troubleshooting

### Import Not Working?

- Check that your CSV has the header row: `word,type`
- Ensure there are no extra blank lines
- Make sure the file encoding is UTF-8
- Verify commas separate the columns (not semicolons or tabs)

### Words Not Appearing?

- Check if they're already in the dictionary (duplicates are skipped)
- Look in all three tabs: Ignored, Entities, Homophones
- Try exporting to verify the import succeeded

## Example Files

See `docs/DICTIONARY_CSV_EXAMPLE.csv` for a complete example.

