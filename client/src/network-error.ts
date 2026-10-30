// Sem rede, o fetch rejeita com TypeError ("Failed to fetch") ou estoura o tempo limite.
export function isNetworkFailure(cause: unknown) {
  return (
    cause instanceof TypeError ||
    (cause instanceof Error &&
      (cause.name === "TimeoutError" || cause.name === "AbortError"))
  );
}

export function describeFailure(cause: unknown) {
  if (isNetworkFailure(cause))
    return "Sem internet no momento. Tente de novo quando tiver sinal.";
  return cause instanceof Error ? cause.message : String(cause);
}
