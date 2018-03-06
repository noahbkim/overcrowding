const width = window.innerWidth;
const height = window.innerHeight;


/* Create the projection of the US map. */
let projection;
let path;

/* Create a new SVG. */
let svg = d3.select("#overcrowding");
svg.append("rect")
  .attr("class", "background")
  .attr("width", width)
  .attr("height", height);

let g = svg.append("g");

/* Queue assets. */
queue()
  //.defer(d3.json, "/data/maryland.geojson")
  .defer(d3.json, "/data/clusters.topojson")
  .defer(d3.json, "/data/schools.geojson")
  .await(draw);

/* Centered clusters. */
let cluster;


function draw(error, clusters, schools) {

  let geojson = topojson.feature(clusters, clusters.objects.clusters);

  projection = d3.geo.albers().scale(1).translate([0, 0]);
  path = d3.geo.path().projection(projection);
  let bounds = path.bounds(geojson);
  let scale = .95 / Math.max((bounds[1][0] - bounds[0][0]) / width, (bounds[1][1] - bounds[0][1]) / height);
  let offset = [(width - scale * (bounds[1][0] + bounds[0][0])) / 2, (height - scale * (bounds[1][1] + bounds[0][1])) / 2];
  projection.scale(scale).translate(offset);

  g.append("path")
    .datum(topojson.merge(clusters, clusters.objects.clusters.geometries))
    .attr("d", path)
    .attr("class", "maryland");

  g.append("path")
    .datum(topojson.mesh(clusters, clusters.objects.clusters, (a, b) => a !== b))
    .attr("d", path)
    .attr("class", "border");

  g.append("g").attr("class", "clusters")
    .selectAll("path")
    .data(geojson.features).enter().append("path")
    .attr("d", path)
    .attr("class", "cluster")
    .on("click", click);

}


function click(d) {
  let x, y, w, h, k;
  if (d !== undefined && d.hasOwnProperty("id") && d !== cluster) {
    // load sidebar
  } else {
    // clear sidebar
  }

  /* Find the center and zoom for the state. */
  if (d && cluster !== d) {
    let centroid = path.centroid(d);
    let bounds = path.bounds(d);
    x = centroid[0];
    y = centroid[1];
    w = bounds[1][0] - bounds[0][0];
    h = bounds[1][1] - bounds[0][1];
    k = 1 / (1.5 * Math.max(w / width, h / height));
    cluster = d;
  } else {
    x = width / 2;
    y = height / 2;
    k = 1;
    cluster = null;
  }

  /* Set the path as active and zoom. */
  g.selectAll("path")
    .classed("active", cluster && function(d) { return d === cluster; });
  g.transition()
    .duration(750)
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")
    .style("stroke-width", 1.5 / k + "px");

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