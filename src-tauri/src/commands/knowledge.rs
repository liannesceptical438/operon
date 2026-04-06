use serde::{Deserialize, Serialize};

// ── PubMed E-utilities API ──
// Uses NCBI's free E-utilities: https://www.ncbi.nlm.nih.gov/books/NBK25500/
// No API key required for < 3 requests/sec; with key allows 10/sec.

const ESEARCH_URL: &str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const ESUMMARY_URL: &str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";
const EFETCH_URL: &str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PubMedArticle {
    pub pmid: String,
    pub title: String,
    pub authors: String,
    pub journal: String,
    pub year: String,
    pub abstract_text: String,
    pub doi: String,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PubMedSearchResult {
    pub query: String,
    pub total_found: u64,
    pub articles: Vec<PubMedArticle>,
}

// ── NCBI JSON response shapes ──

#[derive(Debug, Deserialize)]
struct ESearchResult {
    esearchresult: Option<ESearchInner>,
}

#[derive(Debug, Deserialize)]
struct ESearchInner {
    count: Option<String>,
    idlist: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct ESummaryResult {
    result: Option<serde_json::Value>,
}

/// Search PubMed for articles matching a query.
/// Returns up to `max_results` articles with title, authors, abstract, etc.
#[tauri::command]
pub async fn search_pubmed(
    query: String,
    max_results: Option<u32>,
) -> Result<PubMedSearchResult, String> {
    let limit = max_results.unwrap_or(5).min(15);
    eprintln!("[PubMed] Searching for: '{}' (max {})", query, limit);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    // Step 1: ESearch — get PMIDs matching the query
    let search_resp = client
        .get(ESEARCH_URL)
        .query(&[
            ("db", "pubmed"),
            ("retmode", "json"),
            ("retmax", &limit.to_string()),
            ("sort", "relevance"),
            ("term", &query),
        ])
        .send()
        .await
        .map_err(|e| format!("PubMed search failed: {}", e))?;

    let search_data: ESearchResult = search_resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse PubMed search response: {}", e))?;

    let inner = search_data
        .esearchresult
        .ok_or("No search results returned")?;

    let total_found: u64 = inner.count.as_deref().unwrap_or("0").parse().unwrap_or(0);

    let pmids = inner.idlist.unwrap_or_default();
    eprintln!(
        "[PubMed] Found {} PMIDs (total: {})",
        pmids.len(),
        total_found
    );

    if pmids.is_empty() {
        return Ok(PubMedSearchResult {
            query,
            total_found: 0,
            articles: vec![],
        });
    }

    let id_list = pmids.join(",");

    // Step 2: EFetch — get abstracts (XML→text, the only way to get full abstracts)
    let abstracts = fetch_abstracts(&client, &id_list).await.unwrap_or_default();

    // Step 3: ESummary — get metadata (title, authors, journal, date, DOI)
    let summary_resp = client
        .get(ESUMMARY_URL)
        .query(&[("db", "pubmed"), ("retmode", "json"), ("id", &id_list)])
        .send()
        .await
        .map_err(|e| format!("PubMed summary failed: {}", e))?;

    let summary_data: ESummaryResult = summary_resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse PubMed summary: {}", e))?;

    let result_obj = summary_data.result.unwrap_or(serde_json::Value::Null);

    let mut articles = Vec::new();

    for pmid in &pmids {
        if let Some(article) = result_obj.get(pmid) {
            let title = article
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let authors = article
                .get("authors")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
                        .collect::<Vec<_>>()
                        .join(", ")
                })
                .unwrap_or_default();

            let journal = article
                .get("fulljournalname")
                .or_else(|| article.get("source"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let year = article
                .get("pubdate")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .chars()
                .take(4)
                .collect::<String>();

            let doi = article
                .get("elocationid")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .replace("doi: ", "")
                .to_string();

            let abstract_text = abstracts.get(pmid.as_str()).cloned().unwrap_or_default();

            articles.push(PubMedArticle {
                pmid: pmid.clone(),
                title,
                authors,
                journal,
                year,
                abstract_text,
                doi,
                url: format!("https://pubmed.ncbi.nlm.nih.gov/{}/", pmid),
            });
        }
    }

    eprintln!(
        "[PubMed] Returning {} articles with abstracts",
        articles
            .iter()
            .filter(|a| !a.abstract_text.is_empty())
            .count()
    );

    Ok(PubMedSearchResult {
        query,
        total_found,
        articles,
    })
}

/// Fetch full abstracts via EFetch (returns XML which we parse minimally)
async fn fetch_abstracts(
    client: &reqwest::Client,
    id_list: &str,
) -> Result<std::collections::HashMap<String, String>, String> {
    let resp = client
        .get(EFETCH_URL)
        .query(&[
            ("db", "pubmed"),
            ("rettype", "abstract"),
            ("retmode", "xml"),
            ("id", id_list),
        ])
        .send()
        .await
        .map_err(|e| format!("EFetch failed: {}", e))?;

    let xml = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read EFetch response: {}", e))?;

    // Simple XML parsing: extract <PMID> and <AbstractText> pairs
    let mut abstracts = std::collections::HashMap::new();
    let mut current_pmid = String::new();

    for article_xml in xml.split("<PubmedArticle>").skip(1) {
        // Extract PMID
        if let Some(pmid) = extract_xml_tag(article_xml, "PMID") {
            current_pmid = pmid;
        }

        // Extract abstract — combine all <AbstractText> sections
        let mut abstract_parts = Vec::new();
        let mut search_from = 0;
        while let Some(start) = article_xml[search_from..].find("<AbstractText") {
            let abs_start = search_from + start;
            // Find the end of the opening tag (handles attributes like Label="BACKGROUND")
            if let Some(tag_end) = article_xml[abs_start..].find('>') {
                let content_start = abs_start + tag_end + 1;
                if let Some(end) = article_xml[content_start..].find("</AbstractText>") {
                    let text = &article_xml[content_start..content_start + end];
                    // Strip any inner XML tags
                    let clean = strip_xml_tags(text);
                    // Check for a Label attribute
                    let tag_str = &article_xml[abs_start..abs_start + tag_end];
                    if let Some(label) = extract_xml_attr(tag_str, "Label") {
                        abstract_parts.push(format!("{}: {}", label, clean));
                    } else {
                        abstract_parts.push(clean);
                    }
                    search_from = content_start + end;
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        if !abstract_parts.is_empty() && !current_pmid.is_empty() {
            abstracts.insert(current_pmid.clone(), abstract_parts.join(" "));
        }
    }

    Ok(abstracts)
}

fn extract_xml_tag(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{}", tag);
    let close = format!("</{}>", tag);
    if let Some(start) = xml.find(&open) {
        // Find end of opening tag
        if let Some(tag_end) = xml[start..].find('>') {
            let content_start = start + tag_end + 1;
            if let Some(end) = xml[content_start..].find(&close) {
                return Some(xml[content_start..content_start + end].trim().to_string());
            }
        }
    }
    None
}

fn extract_xml_attr(tag: &str, attr: &str) -> Option<String> {
    let pattern = format!("{}=\"", attr);
    if let Some(start) = tag.find(&pattern) {
        let val_start = start + pattern.len();
        if let Some(end) = tag[val_start..].find('"') {
            return Some(tag[val_start..val_start + end].to_string());
        }
    }
    None
}

fn strip_xml_tags(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut in_tag = false;
    for ch in text.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(ch),
            _ => {}
        }
    }
    result
}
