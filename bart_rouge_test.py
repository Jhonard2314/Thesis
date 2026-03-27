import torch
from transformers import BartForConditionalGeneration, BartTokenizer
from rouge_score import rouge_scorer
import time

def summarize_with_bart_cnn(text):
    """
    Summarizes news articles using the facebook/bart-large-cnn pre-trained model.
    """
    model_name = "facebook/bart-large-cnn"
    print(f"Loading {model_name}...")
    
    # Load tokenizer and model
    tokenizer = BartTokenizer.from_pretrained(model_name)
    model = BartForConditionalGeneration.from_pretrained(model_name)
    
    # Prepare input
    inputs = tokenizer([text], max_length=1024, return_tensors="pt", truncation=True)
    
    # Generate Summary
    print("Generating summary...")
    summary_ids = model.generate(
        inputs["input_ids"], 
        num_beams=4, 
        max_length=150, 
        min_length=40,
        early_stopping=True
    )
    
    summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
    return summary

def evaluate_summary(reference, generated):
    """
    Evaluates the generated summary against a reference summary using ROUGE scores.
    """
    print("\nCalculating ROUGE scores...")
    scorer = rouge_scorer.RougeScorer(['rouge1', 'rouge2', 'rougeL'], use_stemmer=True)
    scores = scorer.score(reference, generated)
    
    print("\n" + "="*40)
    print("ROUGE Evaluation Results:")
    print("="*40)
    for key, score in scores.items():
        print(f"{key.upper()}:")
        print(f"  Precision: {score.precision:.4f}")
        print(f"  Recall:    {score.recall:.4f}")
        print(f"  F1-Score:  {score.fmeasure:.4f}")
    print("="*40)

if __name__ == "__main__":
    # Sample News Article (Source: BBC News)
    sample_article = """
    The UK's inflation rate has fallen to 1.7% in September, its lowest level in three and a half years. 
    The drop, which was larger than expected, was driven by lower airfares and petrol prices. 
    It is the first time the rate has fallen below the Bank of England's 2% target since April 2021. 
    Economists say the fall makes it more likely that the Bank of England will cut interest rates at its next meeting in November. 
    Official figures from the Office for National Statistics (ONS) showed that inflation, the rate at which prices rise, fell from 2.2% in August. 
    Lower airfares, which usually drop after the summer holidays, and lower fuel prices for drivers were the main factors behind the decrease. 
    However, prices for food and non-alcoholic beverages continued to rise, although at a slower pace than in previous months.
    """

    # Reference Summary (Human-written or Golden Standard)
    reference_summary = """
    UK inflation fell to 1.7% in September, the lowest level in over three years and below the Bank of England's 2% target. 
    The decrease was mainly due to lower airfares and fuel prices, increasing the likelihood of an interest rate cut in November.
    """

    print("--- BART-CNN Summarization and ROUGE Evaluation ---")
    start_time = time.time()
    
    # Generate summary
    generated_summary = summarize_with_bart_cnn(sample_article)
    
    print("\nOriginal Article Length:", len(sample_article.split()), "words")
    print("Generated Summary Length:", len(generated_summary.split()), "words")
    print("\nGenerated Summary:")
    print("-" * 20)
    print(generated_summary)
    print("-" * 20)
    
    # Evaluate summary
    evaluate_summary(reference_summary, generated_summary)
    
    end_time = time.time()
    print(f"\nTotal execution time: {end_time - start_time:.2f} seconds")
    print("\nNOTE: To run this script, you must install rouge-score: pip install rouge-score")
