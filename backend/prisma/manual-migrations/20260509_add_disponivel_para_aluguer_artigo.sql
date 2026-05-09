IF COL_LENGTH('Artigo', 'DisponivelParaAluguer') IS NULL
BEGIN
    ALTER TABLE Artigo
    ADD DisponivelParaAluguer BIT NOT NULL
        CONSTRAINT DF_Artigo_DisponivelParaAluguer DEFAULT 0;
END;

EXEC sp_executesql N'
UPDATE Artigo
SET DisponivelParaAluguer = 1
WHERE EXISTS (
    SELECT 1
    FROM TamanhoArtigo ta
    WHERE ta.IdArtigo = Artigo.IdArtigo
);';
