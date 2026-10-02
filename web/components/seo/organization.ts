export const BASE_URL = "https://shelterdk.dk";

/**
 * Ét kanonisk @id for brandet.
 *
 * Artikler og guides erklærede hver sin inline `{"@type":"Organization",
 * name:"ShelterDK"}`. For en parser er det ikke nødvendigvis samme entitet som
 * Organization-objektet på forsiden — hver forekomst kan læses som et nyt,
 * egenskabsløst objekt. Med en @id-reference peger alle sider på den ene
 * erklæring med logo, kontaktpunkt og areaServed.
 */
export const ORGANIZATION_ID = `${BASE_URL}#organization`;
export const ORGANIZATION_REF = { "@id": ORGANIZATION_ID } as const;
