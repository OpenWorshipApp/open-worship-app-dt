## Circular Dependencies Error

When working with Modular projects, you might encounter a "Circular Dependencies" error. This typically occurs when two or more modules depend on each other, creating a loop that modules handler cannot resolve during initialization.

#### Example Scenario where Circular Dependency occurs:

```
Uncaught ReferenceError: Cannot access 'BibleItem' before initialization
    at ReadIdOnlyBibleItem.ts:3:42
```

When you see an error like the one above, it indicates that in `ReadIdOnlyBibleItem.ts` there is a reference to `BibleItem` that is causing a circular dependency.

![Circular Dep error for BibleItem](<../screenshots/Screenshot 2025-11-30 at 11.48.06 AM.png>)

#### How to Resolve Circular Dependencies

* By using [dependency-cruiser](https://www.npmjs.com/package/dependency-cruiser)
* `npm run dc:err`
* This will generate a report of circular dependencies in your project.
* Review the generated report to identify the modules involved in the circular dependency.
* Try to import type instead. e.g: `import type LookupBibleItemController from '../../bible-reader/LookupBibleItemController';`


![Screenshot for Circular Lookup](<../screenshots/Screenshot 2025-11-30 at 11.54.27 AM.png>)


