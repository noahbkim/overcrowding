const W = window.innerWidth - 350;
const H = window.innerHeight;

const CAPACITY = "Capacity";
const ENROLLMENT = "Enrollment";



function teardrop(projection) {
  return (school) => {
    let c = projection(school["geometry"]["coordinates"]);
    return [
      "M", c[0] + "," + c[1],
      "c -5,-7 -5,-14 -5,-15",
      "c 0,-7 10,-7 10,0",
      "c 0,1 0,8 -5,15",
      "z"
    ].join(" ");
  }
}


class Renderer {

  constructor(svg) {
    this.projection = d3.geo.albers().scale(1).translate([0, 0]);
    this.path = d3.geo.path().projection(this.projection);
    this.svg = svg;
    this.background();
    this.g = svg.append("g");
  }

  center(bounds) {
    let scale = .95 / Math.max((bounds[1][0] - bounds[0][0]) / W, (bounds[1][1] - bounds[0][1]) / H);
    let offset = [(W - scale * (bounds[1][0] + bounds[0][0])) / 2, (H - scale * (bounds[1][1] + bounds[0][1])) / 2];
    this.projection.scale(scale).translate(offset);
  }

  background() {
    this.svg.append("rect")
      .attr("class", "background")
      .attr("width", W)
      .attr("height", H);
  }

}


class Controller {

  constructor() {
    this.d = {clusters: null, cluster: null, school: null, schools: null, capacity: null};  // raw data
    this.c = {schools: {}, clusters: {}, clustersRaw: {}, total: [0, 0]};  // computed data
    this.o = {county: null, clusters: null, schools: null};  //
    this.r = new Renderer(
      d3.select("#overcrowding").append("svg")
        .attr("width", W)
        .attr("height", H));
  }

  load(error, clusters, capacity) {
    this.d.clusters = clusters;
    this.d.capacity = capacity;
    this.d.schools = topojson.feature(this.d.clusters, this.d.clusters.objects.schools);
    this.d.clusters.geo = topojson.feature(this.d.clusters, this.d.clusters.objects.clusters);
    if (!error) {
      this.draw();
      this.data();
    }
    else console.log(error);
  }

  draw() {
    this.r.center(this.r.path.bounds(this.d.clusters.geo));
    //this.drawCounty();
    this.drawClusters();
    this.drawBorders();
  }

  drawCounty() {
    this.o.county = this.r.g.append("path");
    this.o.county
      .datum(topojson.merge(this.d.clusters, this.d.clusters.objects.clusters.geometries))
      .attr("d", this.r.path)
      .attr("class", "montgomery");
  }

  drawBorders() {
    this.r.g.append("path")
      .datum(topojson.mesh(this.d.clusters, this.d.clusters.objects.clusters, (a, b) => a !== b))
      .attr("d", this.r.path)
      .attr("class", "border");
  }

  drawClusters() {
    this.o.clusters = this.r.g.append("g").attr("class", "clusters")
      .selectAll("path")
      .data(this.d.clusters.geo.features).enter().append("path")
      .attr("d", this.r.path)
      .attr("class", "cluster")
      .on("click", this.selectCluster.bind(this));
  }

  drawSchools(clusterId) {
    this.o.schools = this.r.g.append("g").attr("class", "schools")
      .selectAll("path")
      .data(this.d.schools.features.filter(s => s["properties"]["cluster"] === clusterId)).enter().append("path")
      .attr("d", teardrop(this.r.projection))
      .attr("class", "school");
  }

  removeSchools() {
    if (this.o.schools) {
      this.o.schools.remove();
      this.o.schools = null;
    }
  }

  data() {
    let capacity, enrollment;

    // Capacity and enrollment
    for (let school of this.d.clusters.objects.schools.geometries) {
      let schoolId = school["properties"]["s_id3"];
      let clusterId = school["properties"]["cluster"];
      capacity = parseFloat(this.search(schoolId, "2016", CAPACITY) || "0");
      enrollment = parseFloat(this.search(schoolId, "2016", ENROLLMENT) || "0");
      if (capacity && enrollment) {
        this.c.schools[schoolId] = [enrollment, capacity];
        if (!this.c.clustersRaw.hasOwnProperty(clusterId))
          this.c.clustersRaw[clusterId] = [0, 0];
        this.c.clustersRaw[clusterId][0] += enrollment;
        this.c.clustersRaw[clusterId][1] += capacity;
        this.c.total[0] += enrollment;
        this.c.total[1] += capacity;
      }
    }

    // Compute fractions
    for (let cluster of this.d.clusters.objects.clusters.geometries) {
      let clusterId = cluster["properties"]["id"];
      this.c.clusters[clusterId] = this.c.clustersRaw[clusterId][0] / this.c.clustersRaw[clusterId][1];
    }

    this.dataStatistics();
    this.dataHeatmap();

  }

  dataStatistics() {
    d3.select("#net-enrollment").text(this.c.total[0] + " (" +
      Math.round(this.c.total[0] / this.c.total[1] * 100) + "%)");
    d3.select("#net-capacity").text(this.c.total[1]);
    let schools = Object.values(this.c.schools);
    let overEnrolled = schools.filter(t => t[0] > t[1]).length;
    d3.select("#total-schools").text(schools.length);
    d3.select("#over-enrolled").text(overEnrolled + " (" + Math.round(overEnrolled / schools.length * 100) + "%)");
  }

  dataHeatmap() {
    let min = 0.75; //Math.min.apply(Math, Object.values(this.c.clusters));
    let max = Math.max.apply(Math, Object.values(this.c.clusters));
    let range = max - min;
    this.o.clusters.style("fill", cluster => {
      let value = (this.c.clusters[cluster["properties"]["id"]] - min) / range;
      return "rgba(" + Math.round(255 * value) + ", " + Math.round(255 * (1 - value)) + ", 0, 0.5)";
    });
  }

  search(schoolId, year, entryType) {
    let entry = this.d.capacity.filter(c =>
      c["sch_id"] === schoolId && c["year"] === year && c["Type"] === entryType)[0];
    if (!entry) return null;
    return entry["Value"];
  }

  main() {
    queue()
      .defer(d3.json, "/data/clusters.topojson")
      .defer(d3.csv, "/data/capacity.csv")
      .await(this.load.bind(this));
  }

  selectCluster(cluster) {

    let x, y, w, h, k;
    if (cluster !== undefined && cluster !== this.cluster) {
      this.removeSchools();
      this.drawSchools(cluster["properties"]["id"]);
      d3.select("#current-item").text(cluster["properties"]["name"]);
    } else {
      this.removeSchools();
    }

    /* Find the center and zoom for the state. */
    if (cluster && cluster !== this.cluster) {
      let centroid = this.r.path.centroid(cluster);
      let bounds = this.r.path.bounds(cluster);
      x = centroid[0];
      y = centroid[1];
      w = bounds[1][0] - bounds[0][0];
      h = bounds[1][1] - bounds[0][1];
      k = 1 / (1.5 * Math.max(w / W, h / H));
      this.cluster = cluster;
    } else {
      x = W / 2;
      y = H / 2;
      k = 1;
      this.cluster = null;
    }

    /* Set the path as active and zoom. */
    this.r.g.selectAll("path").classed("background", this.cluster && (cluster => cluster !== this.cluster));
    this.r.g.transition().duration(750)
      .attr("transform", "translate(" + W/2 + "," + H/2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")
      .style("stroke-W", 1.5 / k + "px");

  }

}


const controller = new Controller();
controller.main();
