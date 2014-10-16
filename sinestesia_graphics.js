/**
 * Draws various animations.
 * @namespace
 */
var draw = (function () {
  'use strict';

  /**
   * Public methods are contained in this object. All other declared variables
   * are private.
   */
  var publicAPI = {},
    /**
    * Color scale to convert provided values to colors.
    * @memberof draw
    * @private
    */
    colorScale = d3.scale.linear()
      .domain([-1, 0, 1])
      .range(['red', 'white', 'blue']),
    /**
     * Used to sync durations between different animations.
     * @memberof draw
     * @private
    */
    syncedDuration,
    /**
     * Contains pending circle transitions.
     * @memberof draw
     * @private
    */
    ripplingCircleQueue = [],
    /**
     * Set svg element to which everything is drawn.
     * @memberof draw
     * @private
     */
    svg = d3.select('svg'),
    /**
     * Contains pending text transitions.
     * @memberof draw
     * @private
     */
    scrollingTextQueue = [],

    /**
     * Rippling Circle Constants.
     * @const
     * @memberof draw
     * @private
     * @property {string} COLOR
     * @property {number} DURATION
     * @property {number} RADIUS
     * @property {number} STROKE_WIDTH
     * @property {number} X
     * @property {number} Y
     */
    RIPPLING_CIRCLE = {
      COLOR: 'white', // Used only if the value parameter is not valid.
      DURATION: 8000,
      RADIUS: 800,
      STROKE_WIDTH: 200,
      X: $(window).width() / 2, // Screen x position
      Y: 300 // Screen y position
    },

    /**
     * Scrolling Text Constants.
     * @const {Object}
     * @memberof draw
     * @private
     * @property {Object} BACKGROUND - The background properties.
     * @property {string} BACKGROUND.COLOR
     * @property {number} BACKGROUND.HEIGHT
     * @property {number} BACKGROUND.WIDTH
     * @property {number} BACKGROUND.X
     * @property {number} BACKGROUND.Y
     * @property {number} DURATION_MULTIPLIER -
     *   Multiplied by the text's length to get duration.
     * @property {Object} FONT
     * @property {string} FONT.COLOR
     * @property {string} FONT.FAMILY
     * @property {string} FONT.SIZE
     * @property {number} MIN_DURATION - Sets a minimum scrolling duration.
     * @property {Object} POSITION
     * @property {number} POSITION.X
     * @property {number} POSITION.Y
     */
    SCROLLING_TEXT = {
      BACKGROUND: { // The background is an svg rect.
        COLOR: 'black',
        HEIGHT: 200,
        WIDTH: $(window).width(),
        X: 0,
        Y: 200
      },
      DURATION_MULTIPLIER: 2,
      FONT: {COLOR: 'white', FAMILY: 'Arial', SIZE: '10em'},
      MIN_DURATION: 2000,
      POSITION: {X: $(window).width(), Y: 350},
    };

  /**
   * Creates an svg circle with a ripple transition.
   * @function ripplingCircle
   * @memberof draw
   * @param {number} value - The value associated with the circle.
   *   It is converted to a color using the color scale.
   * @param {Object=} options - Various optional settings.
   * @param {boolean} options.getSync -
   *   If true, the value of syncedDuration is used instead of the default
   *   duration value.
   * @param {boolean} options.setSync -
   *   If true, sets syncedDuration to the value of this transition's duration.
   * @public
   */
  publicAPI.ripplingCircle = function makeCircle(value, options) {
    var circle, duration, transition,
      // Get the existing group, or create a new one.
      group = svg.select('g').empty() ?
        svg.append('svg:g') : svg.select('g'),
      // Boolean to check if this is the first circle.
      firstCircleElement = group.select('circle').empty();

    // Type check the required parameters, and log any issues.
    if (typeof value !== 'number' || value !== value) { // NaN !== NaN
      console.log(
        'Warning in ripplingCircle method: ' +
        'The value provided is not a number.'
      );
    }

    // If getSync is true, use the value of syncedDuration.
    duration = (options.getSync === true && syncedDuration) ?
      syncedDuration : RIPPLING_CIRCLE.DURATION;
    // If setSync is true, set syncedDuration.
    if (options.setSync === true) {syncedDuration = duration;}

    // Create an svg circle in the group.
    circle = group.insert('svg:circle', 'rect')
      .attr('cx', RIPPLING_CIRCLE.X)
      .attr('cy', RIPPLING_CIRCLE.Y)
      .attr('r', 0) // Initially it has zero radius.
      .style('fill', 'none') // Keep only the circle border.
      .style('stroke', colorScale(+value) || RIPPLING_CIRCLE.COLOR) // Set the color.
      .style('stroke-width', RIPPLING_CIRCLE.STROKE_WIDTH); // Set the border width.

    transition = function () {
      circle.transition()
        // Check if using synced value and that synced value is defined.
        .duration(duration)
        .ease('linear')
      .attr('r', RIPPLING_CIRCLE.RADIUS) // Expand to this size
      .style('stroke-width', 0) // Decreasing border width
      .style('stroke-opacity', 0) // Increasing border transparency
      .each('end', function () {
        // If there are transitions in the queue, start them.
        if (ripplingCircleQueue.length) {
          ripplingCircleQueue.shift()();
        }
      })
      .remove(); // Remove the circle at the end of the transition.
    };

    // If this is the first circle, invoke the transition immediately.
    if (firstCircleElement) {transition();}
    // Otherwise, add the transition to the queue.
    else {ripplingCircleQueue.push(transition);}
  };

  /**
   * Creates svg text that transitions from one position to another.
   * @function scrollingText
   * @memberof draw
   * @param {string} text - The text to display scrolling across the screen.
   * @param {number=} value - The value associated with the text.
   *   It is converted to a color using the color scale.
   * @param {Object=} options - Various optional settings.
   * @param {boolean} options.getSync -
   *   If true, the value of syncedDuration is used instead of the default
   *   duration value.
   * @param {boolean} options.setSync -
   *   If true, sets syncedDuration to the value of this transition's duration..
   * @public
   */
  publicAPI.scrollingText = function makeScrollingText(text, value, options) {
    var duration, svgRect, svgText, textBBox, transition,
      // Get the existing group, or create a new one.
      group = svg.select('g').empty() ?
        svg.append('svg:g') : svg.select('g'),
      // Boolean to check if this is the first text element.
      firstTextElement = group.select('text').empty();

    // Type check the required parameters, and log any issues.
    if (typeof text !== 'string' && !(text instanceof String)) {
      console.log(
        'Warning in scrollingText method: ' +
        'The text provided is not a string.'
      );
    }

    // If there is no svg rect element for a background, create one.
    if (group.select('rect').empty()) {
      svgRect = group.append('svg:rect')
        .attr('height', SCROLLING_TEXT.BACKGROUND.HEIGHT)
        .attr('width', SCROLLING_TEXT.BACKGROUND.WIDTH)
        .attr('x', SCROLLING_TEXT.BACKGROUND.X)
        .attr('y', SCROLLING_TEXT.BACKGROUND.Y)
        .style('fill', SCROLLING_TEXT.BACKGROUND.COLOR)
        .style('fill-opacity', 0.75);
    }

    // Append a text element to the group.
    svgText = group.append('svg:text')
      .text(text)
      .attr('x', SCROLLING_TEXT.POSITION.X)
      .attr('y', SCROLLING_TEXT.POSITION.Y)
      // Defaults to FONT.COLOR if no value was provided.
      .attr('fill', colorScale(+value) || FONT.COLOR)
      .attr('font-family', SCROLLING_TEXT.FONT.FAMILY)
      .attr('font-size', SCROLLING_TEXT.FONT.SIZE);

    // Get the text element's dimensions.
    textBBox = svgText.node().getBBox();
    // If getSync is true, use the value of syncedDuration.
    duration = (options.getSync === true && syncedDuration) ?
      syncedDuration :
      Math.max(
        SCROLLING_TEXT.MIN_DURATION,
        textBBox.width * SCROLLING_TEXT.DURATION_MULTIPLIER
      );
    // If set sync is true, set syncedDuration.
    if (options.setSync === true) {syncedDuration = duration;}

    // Create a function to call the transition.
    transition = function () {
      svgText.transition()
          .duration(duration)
          .ease('linear-in-out')
        .attr('x', -textBBox.width) // Shift left and out of the screen.
        .each('end', function () {
      // If there are transitions in the queue, start them.
          if (scrollingTextQueue.length) {
            scrollingTextQueue.shift()();
          }
        })
        .remove(); // Remove the text element at the end of the transition.
    };

    // If this is the first text element,
    // invoke the transition immediately.
    if (firstTextElement) {transition();}
    // Otherwise, add the transition to the queue.
    else {scrollingTextQueue.push(transition);}
  };

  // Return the object containing public methods and properties.
  // Freeze it to prevent externally changing the method definitions.
  return Object.freeze(publicAPI);

}());
