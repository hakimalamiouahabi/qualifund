(()=>{
  const server=window.LEYTON_RADAR_SERVER_CONFIG||{};
  window.LEYTON_RADAR_CONFIG={
    refreshEndpoint:server.refreshEndpoint||null,
    repositoryUrl:server.repositoryUrl||null,
    sirenApi:'https://recherche-entreprises.api.gouv.fr/search',
    companyEndpoint:server.companyEndpoint||null,
    minRelevance:85,
    version:'12.2.0'
  };
})();
