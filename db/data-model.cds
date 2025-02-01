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
    embeddingModel: String enum {
        ada02
    }
}

entity Chunks: cuid {
    content: LargeString;
    embedding: Vector(1536);
}