const width = window.innerWidth;
const height = window.innerHeight;


/* Create the projection of the US map. */
let projection = d3.geo.mercator();
let path = d3.geo.path().projection(projection);

/* Create a new SVG. */
let svg = d3.select("#overcrowding");
let g = svg.append("g");

/* Queue assets. */
queue()
  .defer(d3.json, "/data/clusters.geojson")
  .defer(d3.json, "/data/schools.geojson")
  .await(draw);



function draw(error, clusters, schools) {

  let center = d3.geo.centroid(clusters);
  let bounds = path.bounds(clusters);
  let vertical = height / (bounds[1][0] - bounds[0][0]);
  let horizontal = width / (bounds[1][1] - bounds[0][1]);
  let scale = Math.min(vertical, horizontal);
  let offset = [width - (bounds[1][0] + bounds[0][0]) / 2, height + (bounds[1][1] - bounds[0][1]) / 2];
  projection = d3.geo.mercator().center(center).scale(scale).translate(offset);

  let background = svg.append("rect")
    .attr("class", "background")
    .attr("width", width)
    .attr("height", height);

  svg.selectAll("path").data(clusters.features).enter().append("path")
    .attr("d", path)
    .style("fill", "red")
    .style("stroke-width", "1")
    .style("stroke", "black")

}





/** Called when the shapefile download is ready.
function onShapes(error, us, congress) {
  if (error) throw error;

  g.append("path")
    .datum(topojson.feature(us, us.objects.land))
    .attr("id", "land")
    .attr("d", path);

  /* Draw the border between state.names.
  let stateBorder = g.append("path");
  stateBorder.datum(topojson.mesh(us, us.objects., function(a, b) { return a !== b; }))
    .attr("id", "state-borders")
    .attr("d", path);

  /* Draw each individual state.names.
  let states = g.append("g").attr("id", "states");
  states.selectAll("path")
    .data(topojson.feature(us, us.objects.states).features)
    .enter().append("path")
      .attr("d", path)
      .attr("id", function(d, i) { return d.id; })
      .on("click", clicked)
      .call(function() {
        let statesObject = document.getElementById("states");
        for (let stateId of state.ids) {
          for (let statePath of statesObject.children) {
            if (+statePath.id === stateId) {
              state.paths[stateId] = statePath;
              break;
            }
          }
        }
        ready.done("shapes");
      })


  /* Draw the border between districts.
  g.append("path")
    .datum(topojson.mesh(congress, congress.objects.districts, function(a, b) { return a !== b }))
    .attr("id", "district-borders")
    .attr("d", path)

}
*/