# RAG Evaluation
this projects aims to develop a pipeline for automatically evaluating a given RAG setup, especially hyperparameters shall be evaluated 

Hyperparameters: 

    - LLM Model
    - LLM Temperature
    - Chunking Method
    - Chunk Size
    - Chunk Overlap
    - Embedding Model
    - Embedding Vector Size
    - Amount of Chunks given to LLM
    - System prompt

The scope of this project is limited to:
    
    - LLM Temperature
    - Chunking Method
    - Chunk Size
    - Chunk Overlap
    - Amount of Chunks given to LLM
    - System Prompt

The Pipeline consists of following steps:

    1. Taking a user-made configuration of parameters
    2. Generating Test-Data based on a given taks context
    3. Creating a Task-set for the RAG system to fullfill
    4. let the RAG system solve the tasks
    5. Calculating the accuracy/quality of the answers


