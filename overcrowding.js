const width = window.innerWidth;
const height = window.innerHeight;


/* Create the projection of the US map. */
let projection;
let path;

/* Create a new SVG. */
let svg = d3.select("#overcrowding");

let background = svg.append("rect")
  .attr("class", "background")
  .attr("width", width)
  .attr("height", height);

/* Queue assets. */
queue()
  //.defer(d3.json, "/data/maryland.geojson")
  .defer(d3.json, "/data/clusters.topojson")
  .defer(d3.json, "/data/schools.geojson")
  .await(draw);


function draw(error, clusters, schools) {

  let geojson = topojson.feature(clusters, clusters.objects.clusters);

  projection = d3.geo.albers().scale(1).translate([0, 0]);
  path = d3.geo.path().projection(projection);
  let bounds = path.bounds(geojson);
  let scale = .95 / Math.max((bounds[1][0] - bounds[0][0]) / width, (bounds[1][1] - bounds[0][1]) / height);
  let offset = [(width - scale * (bounds[1][0] + bounds[0][0])) / 2, (height - scale * (bounds[1][1] + bounds[0][1])) / 2];
  projection.scale(scale).translate(offset);

  svg.append("g").attr("class", "clusters")
    .selectAll("path")
    .data(geojson.features).enter().append("path")
    .attr("d", path)
    .attr("class", "cluster");

  let border = svg.append("path")
    .datum(topojson.mesh(clusters, clusters.objects.clusters, (a, b) => a !== b))
    .attr("d", path)
    .attr("class", "border");

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