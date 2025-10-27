// src/utils/gql.js
import { getToken } from "./auth";

export async function gqlFetch(query, variables = {}) {
  const res = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Network ${res.status}: ${text || res.statusText}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(`Unexpected response (not JSON). Body: ${text.slice(0,200)}...`);
  }

  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message || "GraphQL error");
  return json.data;
}
