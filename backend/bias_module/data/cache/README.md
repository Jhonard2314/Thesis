---
task_categories:
  - text-classification
language:
  - en
tags:
  - subjectivity
  - mediabias
  - media-bias
dataset_info:
  features:
  - name: text
    dtype: string
  - name: outlet
    dtype: string
  - name: label
    dtype: int32
  - name: topic
    dtype: string
  - name: news_link
    dtype: string
  - name: biased_words
    dtype: string
  - name: uuid
    dtype: string
  - name: type
    dtype: string
  - name: label_opinion
    dtype: string
  splits:
  - name: train
    num_bytes: 1333005
    num_examples: 3121
  - name: test
    num_bytes: 431960
    num_examples: 1000
  download_size: 945249
  dataset_size: 1764965
configs:
- config_name: default
  data_files:
  - split: train
    path: data/train-*
  - split: test
    path: data/test-*
---
