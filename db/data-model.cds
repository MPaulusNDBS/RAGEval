namespace ragEval;

using {
    cuid,
    managed
} from '@sap/cds/common';

entity Results : cuid,managed {
    configuration: Association to Configuration;
    rating: Decimal;
}

entity Configuration : cuid {
    llmModel: String;
    llmTemperature: String;
    ragPrompt: String;
    taskType: String enum {
        textExtraction;
        tableExtraction;
    };
    chunkSize: Int16;
    chunkOverlap: Int16;
    chunkingMethod: String enum {
        recursiveChunking;
        semanticChunking;
    };
    chunkAmount: Int16;
    embeddingModel: String enum {
        ada02
    }
}

entity SourceDocuments: cuid {
    name: String;
    type: String enum {
        static;
        AIgenerated;
    };
    content: LargeString;
}

entity Tasks : cuid{
    sourceDoc: Association to SourceDocuments;
    question: String;
    answer: String;
}

entity Chunks: cuid {
    testRunID: UUID;
    sourceDoc: Association to SourceDocuments;
    content: LargeString;
    embedding: Vector(1536);
}