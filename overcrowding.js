/** MCPS Overcrowding
 *
 * Developed by Noah Kim (noahbkim@gmail.com)
 * If you're reading this, please hire me! Check out my website, https://noahbkim.com
 */

/* Take snapshot of window size, not conducive to resizing. */
const W = window.innerWidth - 350;
const H = window.innerHeight;

CAPACITY = "Capacity";
ENROLLMENT = "Enrollment";


/* Selection modes. */
const MODE = {NONE: 0, SCHOOL: 1, CLUSTER: 2};

/* URL prefixes. */
const PREFIX = ""; //"overcrowding/"


/** A wrapper for SVG controls. */
class Renderer {

  /** Construct the renderer based on the SVG element. */
  constructor(svg) {
    this.projection = d3.geo.albers().scale(1).translate([0, 0]);  // Projection of map to SVG
    this.path = d3.geo.path().projection(this.projection);  // Path used for drawing map
    this.svg = svg;
    this.background();
    this.g = svg.append("g");
  }

  /** Center the SVG on an arbitrary coordinate. */
  center(bounds) {
    let scale = .95 / Math.max(
      (bounds[1][0] - bounds[0][0]) / W,
      (bounds[1][1] - bounds[0][1]) / H);
    let offset = [
      (W - scale * (bounds[1][0] + bounds[0][0])) / 2,
      (H - scale * (bounds[1][1] + bounds[0][1])) / 2];
    this.projection.scale(scale).translate(offset);
  }

  /** Append the background element. */
  background() {
    this.svg.append("rect")
      .attr("class", "background")
      .attr("width", W)
      .attr("height", H);
  }

  /** Generate a teardrop path pointed at the current SVG coordinate. */
  teardrop(coordinates) {
    let c = this.projection(coordinates);
    return [
      "M ", c[0] + "," + c[1],
      "c -5,-7 -5,-14 -5,-15",
      "c 0,-7 10,-7 10,0",
      "c 0,1 0,8 -5,15",
      "z"
    ].join(" ");
  }

}


/** The data manager for the visualization.
 *
 * The geography data is the central focus of the project, so it is
 * not encapsulated in a plugin but rather managed directly by this
 * instance.
 */
class Data {

  /** Create the data object with container fields. */
  constructor(plugins) {
    this.clusters = null;
    this.schools = null;
    this.plugins = plugins;
  }

  /** Start downloading data. */
  download(callback) {
    let q = queue().defer(d3.json, PREFIX + "data/clusters.topojson");
    for (let plugin of this.plugins)
      q.defer(plugin.parser, plugin.url);
    q.await((error, clusters, ...rest) => {
      if (error) { alert("Failed to load data: " + error); return; }

      /* Prepare the geography data and plugins provided that data. */
      this.prepare(clusters);
      for (let i = 0; i < this.plugins.length; i++)
        this.plugins[i].prepare(rest[i], this.clusters, this.schools)

      /* Finish up and callback. */
      callback();
    });
    console.log("Queued data downloads...");
  }

  /** Prepare and compute features in the dataset. */
  prepare(clusters) {
    this.clusters = clusters;
    this.schools = clusters.objects.schools.geometries;
    this.clusters.geo = topojson.feature(clusters, clusters.objects.clusters);
    this.schools.geo = topojson.feature(clusters, clusters.objects.schools);
  }

}


/** Base class for data plugins to make convenient. */
class Plugin {

  /** Download queue functionality. */
  constructor(parser, url) {
    this.parser = parser;
    this.url = url;
  }

  /** Abstract prepare method. */
  prepare(data, clusters, schools) {}

}


/** Heatmap data plugin. */
class CapacityPlugin extends Plugin {

  constructor() {
    super(d3.csv, PREFIX + "data/capacity.csv");
    this.data = null;
    this.ratios =  {schools: {}, clusters: {}, total: {}};  // Ratios of enrollment to capacity
    this.scales = {schools: [Infinity, -Infinity], clusters: [Infinity, -Infinity]};  // Min and max ratios
    this.total = [0, 0];
  }

  /** Compute capacity and enrollment. */
  prepare(data, clusters, schools) {
    this.data = data;
    let capacity, enrollment;
    for (let school of schools) {

      /* Grab and check capacity and enrollment numbers. */
      let schoolId = school["properties"]["s_id3"];
      let clusterId = school["properties"]["cluster"];
      capacity = parseFloat(this.search(schoolId, "2016", CAPACITY) || "0");
      enrollment = parseFloat(this.search(schoolId, "2016", ENROLLMENT) || "0");
      if (capacity && enrollment) {

        /* School ratios and scales, only because we're already iterating through. */
        this.ratios.schools[schoolId] = [enrollment, capacity];
        this.scales.schools[0] = Math.min(this.scales.schools.min, enrollment / capacity);
        this.scales.schools[0] = Math.max(this.scales.schools.max, enrollment / capacity);

        /* Cluster ratios. */
        if (!this.ratios.clusters.hasOwnProperty(clusterId))
          this.ratios.clusters[clusterId] = [0, 0];
        this.ratios.clusters[clusterId][0] += enrollment;
        this.ratios.clusters[clusterId][1] += capacity;

        /* Total ratios. */
        this.ratios.total[0] += enrollment;
        this.ratios.total[1] += capacity;

      }

      /* Compute cluster ratios after because we have to wait for all ratios. */
      this.scales.clusters[0] = 0.75;  // Math.min.apply(Math, Object.values(this.c.clusters));
      this.scales.clusters[1] = Math.max.apply(Math, Object.values(this.ratios.clusters).map(x => x[0] / x[1]));
    }
  }

  /** Search the CSV by column parameters. */
  search(schoolId, year, entryType) {
    let entry = this.data.filter(c =>
      c["sch_id"] === schoolId && c["year"] === year && c["Type"] === entryType)[0];
    if (!entry) return null;
    return entry["Value"];
  }

  /** Provide a heatmap color for a cluster. */
  getClusterColor(cluster) {
    let ratio = this.ratios.clusters[cluster["properties"]["id"]];
    let scale = this.scales.clusters;
    let value = (ratio[0] / ratio[1] - scale[0]) / (scale[1] - scale[0]);
    return "rgba(" + Math.round(255 * value) + ", " + Math.round(255 * (1 - value)) + ", 0, 0.5)";
  }

  /** Provide a heatmap color for a school. */
  getSchoolColor(school) {
    let ratio = this.ratios.schools[school["properties"]["s_id3"]];
    let scale = this.scales.schools;
    let value = (ratio[0] / ratio[1] - scale[0]) / (scale[1] - scale[0]);
    return "rgba(" + Math.round(255 * value) + ", " + Math.round(255 * (1 - value)) + ", 0, 1)";
  }

}


class Controller {

  constructor() {
    this.capacity = new CapacityPlugin();
    this.data = new Data([this.capacity]);
    this.renderer = new Renderer(d3.select("#overcrowding").append("svg").attr("width", W).attr("height", H));
    this.o = {county: null, clusters: null, schools: null};  // drawn objects
    this.mode = MODE.NONE;
  }

  draw() {
    this.renderer.center(this.renderer.path.bounds(this.data.clusters.geo));
    this.drawClusters();
    this.drawBorders();
  }

  drawClusters() {
    this.o.clusters = this.renderer.g.append("g").attr("class", "clusters")
      .selectAll("path")
      .data(this.data.clusters.geo.features).enter().append("path")
      .attr("d", this.renderer.path)
      .attr("class", "cluster")
      .on("click", this.selectCluster.bind(this));
  }

  drawBorders() {
    this.renderer.g.append("path")
      .datum(topojson.mesh(this.data.clusters, this.data.clusters.objects.clusters, (a, b) => a !== b))
      .attr("d", this.renderer.path)
      .attr("class", "border");
  }

  drawSchools(clusterId) {
    this.o.schools = this.renderer.g.append("g").attr("class", "schools")
      .selectAll("path")
      .data(this.data.schools.geo.features.filter(
        s => s["properties"]["cluster"] === clusterId)).enter()
      .append("path")
        .attr("d", school => this.renderer.marker(school))
        .attr("class", "school")
        .style("stroke", school => this.capacity.getSchoolColor(school))
        .on("click", this.selectSchool.bind(this));
  }

  removeSchools() {
    if (this.o.schools) {
      this.o.schools.remove();
      this.o.schools = null;
    }
  }

  applyStatistics() {
    let enrollment = Math.round(this.capacity.ratios.total[0] / this.capacity.ratios.total[1] * 100);
    d3.select("#net-enrollment").text(this.capacity.ratios.total[0] + " (" + enrollment + "%)");
    d3.select("#net-capacity").text(this.capacity.ratios.total[1]);
    let schools = Object.values(this.capacity.ratios.schools);
    let over = schools.filter(t => t[0] > t[1]).length;
    d3.select("#total-schools").text(schools.length);
    d3.select("#over-enrolled").text(over + " (" + Math.round(over / schools.length * 100) + "%)");
  }

  applyHeatmap() {
    this.o.clusters.style("fill", cluster => this.capacity.getClusterColor(cluster));
  }

  start() {
    this.data.download(this.main.bind(this));
  }

  main() {
    this.draw();
    this.applyHeatmap();
    this.applyStatistics();
  }

  selectCluster(cluster) {

    let x, y, w, h, k;
    if (cluster && cluster !== this.d.cluster) {
      this.removeSchools();
      this.drawSchools(cluster["properties"]["id"]);
      this.clusterStatistics(cluster);
      this.mode = MODE.CLUSTER;
    } else if (this.mode === MODE.SCHOOL) {
      this.selectSchool(null);
      this.clusterStatistics(cluster);
      this.mode = MODE.CLUSTER;
      return;
    } else {
      this.clusterStatistics(null);
      this.removeSchools();
    }

    /* Find the center and zoom for the state. */
    if (cluster && cluster !== this.d.cluster) {
      let centroid = this.r.path.centroid(cluster);
      let bounds = this.r.path.bounds(cluster);
      x = centroid[0];
      y = centroid[1];
      w = bounds[1][0] - bounds[0][0];
      h = bounds[1][1] - bounds[0][1];
      k = 1 / (1.5 * Math.max(w / W, h / H));
      this.d.cluster = cluster;
    } else {
      x = W / 2;
      y = H / 2;
      k = 1;
      this.d.cluster = null;
    }

    /* Set the path as active and zoom. */
    this.r.g.selectAll("path").classed("background", this.d.cluster && (cluster => cluster !== this.d.cluster));
    this.r.g.transition().duration(750)
      .attr("transform", "translate(" + W/2 + "," + H/2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")
      .style("stroke-W", 1.5 / k + "px");

  }

  selectSchool(school) {
    if (school && school !== this.d.school) {
      this.d.school = school;
      this.schoolStatistics(school);
      this.mode = MODE.SCHOOL;
    } else {
      this.d.school = null;
      this.mode = MODE.CLUSTER;
      this.clusterStatistics(this.d.cluster);
    }

    this.r.g.selectAll("path").classed("active", this.d.school && (school => school === this.d.school));
  }

  clusterStatistics(cluster) {
    if (cluster === null) { d3.select("#current-item").text(""); return }
    d3.select("#current-item").text(cluster["properties"]["name"]);
    let clusterId = cluster["properties"]["id"];
    d3.select("#item-capacity").text(this.c.clustersRaw[clusterId][1]);
    d3.select("#item-enrollment").text(this.c.clustersRaw[clusterId][0] + " (" +
      Math.round(100 * this.c.clusters[clusterId]) + "%)");
  }

  schoolStatistics(school) {
    d3.select("#current-item").text(school["properties"]["school"]);
    let schoolId = school["properties"]["s_id3"];
    d3.select("#item-capacity").text(this.c.schoolsRaw[schoolId][1]);
    d3.select("#item-enrollment").text(this.c.schoolsRaw[schoolId][0] + " (" +
      Math.round(100 * this.c.schools[schoolId]) + "%)");
  }

}


const controller = new Controller();
controller.start();
