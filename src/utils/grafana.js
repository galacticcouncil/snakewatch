export default class Grafana {
  constructor(url, datasource) {
    this.url = url
    this.dsn = datasource
  }

  async query(sql) {
    return fetch(this.url, {
      headers: {
        Accept: 'application/json', 'Content-Type': 'application/json',
      }, method: 'POST', body: JSON.stringify({
        queries: [{
          refId: 'buckets', rawSql: sql, format: 'table', datasourceId: Number(this.dsn),
        },],
      }),
    })
      .then(response => response.json())
      .then(data => data.results.buckets.frames[0].data.values)
  }
}
