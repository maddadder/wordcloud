import re
from wordcloud import WordCloud
import matplotlib.pyplot as plt
import pysrt
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import os

# Handle NLTK data download with custom path
try:
    nltk.data.find('tokenizers/punkt_tab')
except LookupError:
    # Download to user's home directory if not found
    nltk.download('punkt_tab', download_dir=os.path.expanduser("~/nltk_data"))
    nltk.data.path.append(os.path.expanduser("~/nltk_data"))

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords', download_dir=os.path.expanduser("~/nltk_data"))
    nltk.data.path.append(os.path.expanduser("~/nltk_data"))

def srt_to_wordcloud(srt_path, output_image='wordcloud.png'):
    # Load subtitles and extract text
    subs = pysrt.open(srt_path)
    full_text = ' '.join(sub.text.replace('\n', ' ') for sub in subs)

    # Clean text
    cleaned_text = re.sub(r'<[^>]+>', '', full_text)  # Remove HTML tags
    cleaned_text = re.sub(r'[^\w\s]', '', cleaned_text.lower())  # Remove punctuation
    cleaned_text = re.sub(r'\d+', '', cleaned_text)  # Remove numbers

    # Tokenize and remove stopwords
    stop_words = set(stopwords.words('english'))
    words = word_tokenize(cleaned_text)
    filtered_words = [word for word in words if word not in stop_words and len(word) > 2]

    # Generate word cloud
    wordcloud = WordCloud(
        width=800,
        height=400,
        background_color='white',
        max_words=200,
        collocations=False  # Disable phrase detection
    ).generate(' '.join(filtered_words))

    # Save output
    plt.figure(figsize=(12, 8))
    plt.imshow(wordcloud, interpolation='bilinear')
    plt.axis('off')
    plt.savefig(output_image, bbox_inches='tight', dpi=300)
    plt.close()  # Prevent plot display in some environments

# Usage
srt_to_wordcloud('output.srt', 'wordcloud.png')
