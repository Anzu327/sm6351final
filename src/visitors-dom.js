export const storySection = document.getElementById('visitors-story');
export const storyStage = document.getElementById('visitors-stage');
export const visitorsRoot = storyStage?.shadowRoot ?? document;
export const visitorsView = visitorsRoot.querySelector('.visitors-view') ?? document.body;

export const visitorsInView = () => !storyStage || !storyStage.inert;
